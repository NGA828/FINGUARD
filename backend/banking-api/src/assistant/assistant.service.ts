import { Injectable } from '@nestjs/common';
import {
  accounts,
  customers,
  disputes,
  fraudAnalyses,
  query,
  systemConfig,
  users,
} from '../database/connection';
import { formatXAF } from '../common/utils';
import { detectIntent, type Intent, type NluResult } from './nlu';
import { LlmService } from './llm.service';

/** Carte transaction renvoyée à l'interface de chat. */
export interface TxCard {
  id: string;
  reference: string;
  type: string;
  typeLabel: string;
  amount: number;
  status: string;
  statusLabel: string;
  riskLevel: string | null;
  riskScore: number | null;
  beneficiary: string | null;
  createdAt: string;
}

export interface ChatResponse {
  reply: string;
  intent: Intent;
  engine: 'builtin' | 'llm';
  spoken?: string;
  transactions?: TxCard[];
  suggestions?: string[];
}

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
  TRANSFER: 'Virement',
  PAYMENT: 'Paiement',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours de traitement',
  COMPLETED: 'Terminée',
  FAILED: 'Échouée',
  REJECTED: 'Rejetée',
  UNDER_REVIEW: 'En attente de révision',
  CANCELLED: 'Annulée',
};

const RISK_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé' };

const DEFAULT_SUGGESTIONS = [
  'Quel est mon solde ?',
  'Mes dernières transactions',
  'Pourquoi ma transaction est en attente ?',
  'Comment fonctionne la détection de fraude ?',
];

/** Libellé humain d'un indicateur du moteur de fraude. */
const INDICATOR_LABELS: Record<string, string> = {
  VERY_LARGE_AMOUNT: 'Montant exceptionnellement élevé',
  LARGE_AMOUNT: 'Montant élevé',
  UNUSUAL_VS_HISTORY: 'Montant inhabituel par rapport à votre historique',
  HIGH_VELOCITY: 'Nombre élevé de transactions en peu de temps',
  ODD_HOURS: 'Transaction effectuée à une heure inhabituelle (nuit)',
  LARGE_BALANCE_RATIO: 'Montant représentant une grande part de votre solde',
  NEW_BENEFICIARY: 'Virement vers un nouveau bénéficiaire',
  DAILY_VOLUME_HIGH: 'Volume quotidien proche de votre limite',
};

/**
 * Service de l'Assistant IA Shield (espace client).
 * Pipeline : NLU intégré (intentions + accès données live) → réponse
 * structurée ; si un LLM externe est configuré et pertinent, il prend
 * le relais pour la formulation.
 */
@Injectable()
export class AssistantService {
  constructor(private readonly llm: LlmService) {}

  // ------------------------------------------------------------------
  // Données client (mêmes règles d'accès que le contrôleur client)
  // ------------------------------------------------------------------

  private customerOf(user: any) {
    return customers.first('user_id = ?', [user.sub]);
  }

  private nameOf(user: any): string {
    const u = users.byId(user.sub);
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'cher client' : 'cher client';
  }

  private accountsOf(customerId: string) {
    return accounts.all('customer_id = ?', [customerId]);
  }

  private txRows(customer: any, limit = 8, typeFilter: string | null = null) {
    const list = this.accountsOf(customer.id).map((a: any) => a.id);
    if (!list.length) return [];
    const ph = list.map(() => '?').join(',');
    const where = `(source_account_id IN (${ph}) OR target_account_id IN (${ph}))${
      typeFilter ? ' AND type = ?' : ''
    }`;
    const rows = query(
      `SELECT * FROM transactions WHERE ${where} ORDER BY created_at DESC LIMIT ${Number(limit)}`,
      [...list, ...list, ...(typeFilter ? [typeFilter] : [])],
    );
    return rows;
  }

  private toCard(t: any): TxCard {
    return {
      id: t.id,
      reference: t.reference,
      type: t.type,
      typeLabel: TYPE_LABELS[t.type] || t.type,
      amount: Number(t.amount),
      status: t.status,
      statusLabel: STATUS_LABELS[t.status] || t.status,
      riskLevel: t.riskLevel ?? t.risk_level ?? null,
      riskScore: t.riskLevel != null || t.risk_level != null ? Number(t.riskScore ?? t.risk_score ?? 0) : null,
      beneficiary: t.beneficiaryName ?? t.beneficiary_name ?? null,
      createdAt: t.createdAt ?? t.created_at,
    };
  }

  private findTxByReference(customer: any, ref: string) {
    const rows = this.txRows(customer, 100);
    const wanted = ref.toUpperCase();
    return rows.find((t: any) => t.reference.toUpperCase() === wanted || t.reference.toUpperCase().includes(wanted)) || null;
  }

  private limits() {
    const map: Record<string, string> = {};
    for (const row of systemConfig.all() as any[]) map[row.key] = row.value;
    return {
      globalPerTxLimit: Number(map.GLOBAL_PER_TX_LIMIT ?? 5000000),
      globalDailyLimit: Number(map.GLOBAL_DAILY_LIMIT ?? 10000000),
    };
  }

  /** Contexte live injecté dans le prompt du LLM externe (si activé). */
  private buildContext(user: any, customer: any): string {
    const accs = this.accountsOf(customer.id);
    const txs = this.txRows(customer, 5).map((t: any) => this.toCard(t));
    const limits = this.limits();
    const lines: string[] = [];
    for (const a of accs) {
      lines.push(`Compte ${a.accountNumber} (${a.status}) : solde ${formatXAF(Number(a.balance))}, limite/transaction ${formatXAF(Number(a.perTxLimit))}, limite quotidienne ${formatXAF(Number(a.dailyLimit))}.`);
    }
    lines.push(`Limites globales de la banque : ${formatXAF(limits.globalPerTxLimit)} par transaction, ${formatXAF(limits.globalDailyLimit)} par jour.`);
    for (const t of txs) {
      lines.push(
        `${t.reference} — ${t.typeLabel} ${formatXAF(t.amount)} — statut ${t.statusLabel}` +
          (t.riskLevel ? ` — risque ${RISK_LABELS[t.riskLevel]} (${t.riskScore}/100)` : ''),
      );
    }
    void user;
    return lines.join('\n');
  }

  // ------------------------------------------------------------------
  // Générateurs de réponses par intention
  // ------------------------------------------------------------------

  private answerBalance(user: any, customer: any): ChatResponse {
    const accs = this.accountsOf(customer.id);
    if (!accs.length) return this.reply('balance', "Je ne trouve aucun compte associé à votre profil. Contactez votre agence.");
    const total = accs.reduce((s: number, a: any) => s + Number(a.balance), 0);
    const parts = accs.map((a: any) => `${a.accountNumber} : ${formatXAF(Number(a.balance))}`);
    const reply =
      accs.length === 1
        ? `Votre solde actuel est de ${formatXAF(total)} sur votre compte ${accs[0].accountNumber}.`
        : `Votre solde cumulé est de ${formatXAF(total)} (${parts.join(' · ')}).`;
    return this.reply('balance', reply, ['Mes dernières transactions', 'Mes limites de paiement']);
  }

  private answerRecent(user: any, customer: any, txType: string | null): ChatResponse {
    const rows = this.txRows(customer, 6, txType);
    if (!rows.length) {
      return this.reply(
        'recent_transactions',
        txType
          ? `Je ne trouve aucun ${TYPE_LABELS[txType].toLowerCase()} récent sur vos comptes.`
          : 'Vous n’avez encore aucune transaction. Faites-en une depuis la page « Transactions » et je pourrai la suivre pour vous.',
      );
    }
    const cards = rows.map((t: any) => this.toCard(t));
    const intro = txType
      ? `Voici vos derniers ${TYPE_LABELS[txType].toLowerCase()}s :`
      : 'Voici vos dernières transactions :';
    return {
      ...this.reply('recent_transactions', `${intro} je vous les affiche ci-dessous. Demandez-moi le détail ou le niveau de risque de l'une d'elles avec sa référence.`, ['Pourquoi une transaction est en attente ?', 'Quel est mon solde ?']),
      transactions: cards,
    };
  }

  private answerStatus(user: any, customer: any, nlu: NluResult): ChatResponse {
    let tx: any = null;
    if (nlu.reference) tx = this.findTxByReference(customer, nlu.reference);
    if (!tx) {
      const rows = this.txRows(customer, 1);
      tx = rows[0] || null;
    }
    if (!tx) return this.reply('transaction_status', "Je ne trouve aucune transaction sur vos comptes pour l'instant.");
    const card = this.toCard(tx);
    const statusSentence: Record<string, string> = {
      COMPLETED: 'l’opération est terminée, les fonds ont bien été mouvementés.',
      PROCESSING: 'l’opération est en cours de traitement.',
      PENDING: 'l’opération attend sa validation.',
      UNDER_REVIEW: 'l’opération est en attente de révision par un employé de la banque après analyse du moteur de fraude.',
      REJECTED: 'l’opération a été rejetée.',
      FAILED: 'l’opération a échoué.',
      CANCELLED: 'l’opération a été annulée.',
    };
    let detail = statusSentence[tx.status] || 'statut inconnu.';
    if (tx.statusReason || tx.status_reason) detail += ` Motif : ${tx.statusReason || tx.status_reason}.`;
    const subject =
      card.type === 'PAYMENT' ? 'Le paiement' : card.type === 'DEPOSIT' ? 'Le dépôt' : card.type === 'TRANSFER' ? 'Le virement' : 'Le retrait';
    const reply = `${subject} ${card.reference} de ${formatXAF(card.amount)} est « ${card.statusLabel} » : ${detail}${
      card.riskLevel ? ` Son niveau de risque est ${RISK_LABELS[card.riskLevel].toLowerCase()} (${card.riskScore}/100).` : ''
    }`;
    return {
      ...this.reply('transaction_status', reply, ['Pourquoi est-elle en attente ?', 'Mes dernières transactions']),
      transactions: [card],
    };
  }

  private answerRisk(user: any, customer: any, nlu: NluResult): ChatResponse {
    let tx: any = null;
    if (nlu.reference) tx = this.findTxByReference(customer, nlu.reference);
    if (!tx) {
      // Dernière transaction analysée avec un score.
      tx = this.txRows(customer, 10).find((t: any) => t.risk_score != null) || null;
    }
    if (!tx) {
      return this.reply(
        'transaction_risk',
        'Je n’ai trouvé aucune transaction analysée sur vos comptes. Dès qu’une opération sera effectuée, le moteur de fraude lui attribuera un score de 0 à 100 et un niveau (Faible, Moyen ou Élevé).',
      );
    }
    const card = this.toCard(tx);
    const analysis = fraudAnalyses.first('transaction_id = ?', [tx.id]);
    const score = Number(tx.risk_score ?? 0);
    const level = RISK_LABELS[tx.risk_level || 'LOW'] || 'Faible';
    let reply = `Niveau de risque du ${card.typeLabel.toLowerCase()} ${card.reference} (${formatXAF(card.amount)}) : ${level.toUpperCase()} — score ${score}/100.`;
    let suggestions = ['Comment fonctionne la détection de fraude ?', 'Mes dernières transactions'];
    if (analysis) {
      let indicators: any[] = [];
      try {
        indicators = JSON.parse(analysis.indicators);
      } catch {
        indicators = [];
      }
      if (indicators.length) {
        const labels = indicators.map((i: any) => `• ${INDICATOR_LABELS[i.code] || i.label || i.code}${i.points ? ` (+${i.points} pts)` : ''}`);
        reply += `\nIndicateurs détectés :\n${labels.join('\n')}`;
      }
      if (analysis.action === 'HOLD') {
        reply += '\nCette opération est conservée en attente : un employé doit l’examiner avant tout mouvement de fonds.';
        suggestions = ['Puis-je la contester ?', 'Comment fonctionne la détection de fraude ?'];
      } else if (analysis.action === 'VERIFY') {
        reply += '\nUne vérification supplémentaire vous a été demandée : confirmez ou rejetez l’opération depuis la page « Transactions ».';
      } else if (analysis.action === 'AUTHORIZE') {
        reply += '\nLe moteur l’a jugée sûre, elle a donc été traitée normalement.';
      }
      if (analysis.summary) reply += `\nRésumé du moteur : ${analysis.summary}`;
    } else if (tx.status === 'REJECTED' && (tx.status_reason || tx.statusReason)) {
      reply += ` Motif : ${tx.status_reason || tx.statusReason}.`;
    }
    return {
      ...this.reply('transaction_risk', reply, suggestions),
      transactions: [card],
    };
  }

  private answerPending(user: any, customer: any): ChatResponse {
    const rows = this.txRows(customer, 20).filter((t: any) =>
      ['PENDING', 'UNDER_REVIEW', 'PROCESSING'].includes(t.status),
    );
    const verify = rows.filter((t: any) => Number(t.requires_verification ?? t.requiresVerification ?? 0) === 1);
    if (!rows.length) {
      return this.reply('pending_actions', 'Bonne nouvelle : aucune transaction n’est en attente sur vos comptes. Tout est à jour. ✅');
    }
    const cards = rows.map((t: any) => this.toCard(t));
    let reply = `Vous avez ${rows.length} transaction(s) en attente.`;
    if (verify.length) {
      reply += ` Dont ${verify.length} qui nécessite(nt) votre confirmation : rendez-vous sur la page « Transactions » pour les confirmer ou les rejeter.`;
    }
    const review = rows.filter((t: any) => t.status === 'UNDER_REVIEW');
    if (review.length) {
      reply += ` ${review.length} est/sont en cours d’examen par un employé (score de risque élevé).`;
    }
    return {
      ...this.reply('pending_actions', reply, ['Pourquoi une transaction est en attente ?', 'Quel est mon solde ?']),
      transactions: cards,
    };
  }

  private answerDispute(user: any, customer: any): ChatResponse {
    const list = disputes.all('customer_id = ?', [customer.id], 'created_at DESC', 3) as any[];
    let reply =
      'Si vous ne reconnaissez pas une transaction, vous pouvez ouvrir un litige : rendez-vous sur la page « Litiges », sélectionnez la transaction concernée et décrivez le problème. Notre équipe enquête généralement sous 48 h.';
    if (list.length) {
      const last = list[0];
      const DISPUTE_LABELS: Record<string, string> = {
        SUBMITTED: 'Soumis',
        UNDER_REVIEW: 'En cours d’examen',
        INVESTIGATING: 'En cours d’investigation',
        RESOLVED: 'Résolu',
        REJECTED: 'Rejeté',
        CLOSED: 'Clos',
      };
      reply += `\nVotre dernier litige (${last.reference}) est actuellement au statut « ${DISPUTE_LABELS[last.status] || last.status} ».`;
    }
    return this.reply('dispute', reply, ['Mes dernières transactions', 'Contacter mon conseiller']);
  }

  private answerFaq(topic: Intent): ChatResponse {
    switch (topic) {
      case 'faq_fees':
        return this.reply(
          'faq_fees',
          'Bonne nouvelle : dans cette version de Shield, aucun frais n’est appliqué sur vos dépôts, retraits, virements ou paiements. Les montants débités correspondent exactement à vos opérations.',
          ['Mes limites de paiement', 'Mes dernières transactions'],
        );
      case 'faq_limits': {
        const cfg = this.limits();
        return this.reply(
          'faq_limits',
          `Vos plafonds dépendent de votre compte et de la configuration globale de la banque. Aujourd’hui, le maximum global est de ${formatXAF(cfg.globalPerTxLimit)} par transaction et ${formatXAF(cfg.globalDailyLimit)} par jour. Vos plafonds personnels (potentiellement plus bas) sont visibles sur votre tableau de bord.`,
          ['Quel est mon solde ?', 'Comment fonctionne la détection de fraude ?'],
        );
      }
      case 'faq_fraud':
        return this.reply(
          'faq_fraud',
          'Chaque transaction passe par notre moteur de détection de fraude avant traitement. Il calcule un score de 0 à 100 à partir de plusieurs indicateurs : montant inhabituel, fréquence des opérations, heure, part du solde, nouveau bénéficiaire… Résultat : score Faible (<30) → opération traitée ; Moyen (30-59) → vérification supplémentaire demandée ; Élevé (≥60) → mise en attente et examen par un employé.',
          ['Pourquoi ma transaction est en attente ?', 'Mes limites de paiement'],
        );
      case 'faq_security':
        return this.reply(
          'faq_security',
          'Vos fonds sont protégés par plusieurs couches : authentification JWT, analyse anti-fraude systématique, vérification supplémentaire sur les opérations sensibles et examen humain des cas suspects. Côté compte, utilisez un mot de passe fort et ne le partagez jamais — Shield ne vous le demandera jamais.',
          ['Comment fonctionne la détection de fraude ?', 'Contacter mon conseiller'],
        );
      case 'faq_contact':
        return this.reply(
          'faq_contact',
          'Vous pouvez contacter votre conseiller via la page « Litiges » (demande écrite) ou passer en agence aux heures ouvrées (lundi-vendredi, 8h-16h). En cas de transaction suspecte, signalez-la immédiatement : un litige déclenche une enquête prioritaire.',
          ['Puis-je contester une transaction ?', 'Comment fonctionne la détection de fraude ?'],
        );
      default:
        return this.reply('fallback', "Je n'ai pas compris votre demande.");
    }
  }

  private reply(intent: Intent, text: string, suggestions?: string[]): ChatResponse {
    return { reply: text, intent, engine: 'builtin', spoken: text.replace(/[✅•·]/g, ''), suggestions };
  }

  // ------------------------------------------------------------------
  // Point d'entrée
  // ------------------------------------------------------------------

  welcome(user: any): ChatResponse {
    const name = this.nameOf(user);
    return this.reply(
      'greeting',
      `Bonjour ${name} 👋 Je suis Shield, votre assistant bancaire. Je peux vous donner votre solde, suivre vos transactions, expliquer un niveau de risque ou une mise en attente, et répondre à vos questions sur les frais, limites et la sécurité. Vous pouvez m'écrire… ou me parler avec le micro 🎤`,
      DEFAULT_SUGGESTIONS,
    );
  }

  async chat(user: any, message: string): Promise<ChatResponse> {
    const customer = this.customerOf(user);
    if (!customer) {
      return this.reply('fallback', 'Profil client introuvable. Veuillez vous reconnecter.');
    }
    const nlu = detectIntent(message);

    // Intention "données live" : réponse structurée du moteur intégré.
    let base: ChatResponse | null = null;
    switch (nlu.intent) {
      case 'greeting':
        base = this.welcome(user);
        break;
      case 'thanks':
        base = this.reply('thanks', 'Avec plaisir ! Je reste disponible si vous avez une autre question. 😊', ['Mes dernières transactions', 'Quel est mon solde ?']);
        break;
      case 'goodbye':
        base = this.reply('goodbye', 'Au revoir et à bientôt sur Shield ! 👋');
        break;
      case 'help':
        base = this.reply(
          'help',
          'Voici ce que je sais faire :\n• Consulter votre solde et vos comptes\n• Lister vos dernières transactions (dépôts, retraits, virements, paiements)\n• Suivre le statut d’une transaction (référence TX-…)\n• Expliquer son niveau de risque et pourquoi elle est bloquée\n• Lister les opérations qui attendent votre confirmation\n• Répondre à vos questions : frais, limites, fraude, sécurité',
          DEFAULT_SUGGESTIONS,
        );
        break;
      case 'balance':
        base = this.answerBalance(user, customer);
        break;
      case 'recent_transactions':
        base = this.answerRecent(user, customer, nlu.txType);
        break;
      case 'transaction_status':
        base = this.answerStatus(user, customer, nlu);
        break;
      case 'transaction_risk':
        base = this.answerRisk(user, customer, nlu);
        break;
      case 'pending_actions':
        base = this.answerPending(user, customer);
        break;
      case 'dispute':
        base = this.answerDispute(user, customer);
        break;
      case 'faq_fees':
      case 'faq_limits':
      case 'faq_fraud':
      case 'faq_security':
      case 'faq_contact':
        base = this.answerFaq(nlu.intent);
        break;
      default:
        base = null;
    }

    // Intentions non résolues ou conversationnelles : essai du LLM externe.
    if (!base) {
      const llmReply = await this.llm.ask(
        user.sub,
        this.nameOf(user),
        message,
        this.buildContext(user, customer),
      );
      if (llmReply) {
        return { reply: llmReply, intent: nlu.intent, engine: 'llm', spoken: llmReply, suggestions: DEFAULT_SUGGESTIONS };
      }
      return this.reply(
        'fallback',
        'Désolé, je n’ai pas compris votre demande. Essayez par exemple : « Quel est mon solde ? », « Mes dernières transactions », « Pourquoi ma transaction est en attente ? » ou tapez « aide ».',
        DEFAULT_SUGGESTIONS,
      );
    }

    return base;
  }
}
