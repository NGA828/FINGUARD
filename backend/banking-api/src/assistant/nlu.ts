/**
 * Moteur NLU intégré de l'Assistant Shield.
 *
 * Détection d'intention par pondération de mots-clés (FR + EN) :
 * aucune dépendance externe, fonctionne hors-ligne. Le module est
 * "LLM-ready" : si une clé API est configurée (voir llm.service.ts),
 * les réponses conversationnelles passent par le modèle externe et
 * ce moteur reste le filet de sécurité.
 */

export type Intent =
  | 'greeting'
  | 'thanks'
  | 'goodbye'
  | 'help'
  | 'balance'
  | 'recent_transactions'
  | 'transaction_status'
  | 'transaction_risk'
  | 'pending_actions'
  | 'dispute'
  | 'faq_fees'
  | 'faq_limits'
  | 'faq_fraud'
  | 'faq_security'
  | 'faq_contact'
  | 'fallback';

export interface NluResult {
  intent: Intent;
  /** Référence de transaction détectée (ex. TX-2026-123456). */
  reference: string | null;
  /** Filtre de type demandé ("montre mes virements"). */
  txType: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'PAYMENT' | null;
  confidence: number;
}

/** Normalisation : minuscules, sans accents, espaces compressés. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Poids par défaut d'un mot-clé ; les expressions composées pèsent plus. */
interface KeywordRule {
  intent: Intent;
  terms: { t: string; w: number }[];
}

const RULES: KeywordRule[] = [
  {
    intent: 'greeting',
    terms: [
      { t: 'bonjour', w: 3 }, { t: 'bonsoir', w: 3 }, { t: 'salut', w: 2 },
      { t: 'coucou', w: 2 }, { t: 'hello', w: 2 }, { t: 'hi', w: 1 },
      { t: 'hey', w: 1 }, { t: 'yo', w: 1 },
    ],
  },
  {
    intent: 'thanks',
    terms: [
      { t: 'merci', w: 3 }, { t: 'thanks', w: 3 }, { t: 'thank you', w: 3 },
      { t: 'super', w: 1 }, { t: 'parfait', w: 1 },
    ],
  },
  {
    intent: 'goodbye',
    terms: [
      { t: 'au revoir', w: 3 }, { t: 'bye', w: 3 }, { t: 'goodbye', w: 3 },
      { t: 'a bientot', w: 3 }, { t: 'a plus', w: 2 }, { t: 'ciao', w: 2 },
    ],
  },
  {
    intent: 'help',
    terms: [
      { t: 'aide', w: 3 }, { t: 'help', w: 3 }, { t: 'que peux-tu faire', w: 4 },
      { t: 'que sais-tu faire', w: 4 }, { t: 'what can you do', w: 4 },
      { t: 'tes capacites', w: 3 }, { t: 'fonctionnalites', w: 2 },
      { t: 'a quoi tu sers', w: 3 },
    ],
  },
  {
    intent: 'balance',
    terms: [
      { t: 'solde', w: 4 }, { t: 'balance', w: 3 }, { t: 'combien ai-je', w: 4 },
      { t: "combien j'ai", w: 4 }, { t: 'mon argent', w: 3 },
      { t: 'disponible sur mon compte', w: 4 }, { t: 'mon compte', w: 1 },
    ],
  },
  {
    intent: 'transaction_risk',
    terms: [
      { t: 'risque', w: 4 }, { t: 'risk level', w: 4 }, { t: 'niveau de risque', w: 4 },
      { t: 'score de risque', w: 4 }, { t: 'pourquoi bloquee', w: 4 },
      { t: 'pourquoi en attente', w: 3 }, { t: 'pourquoi suspendue', w: 4 },
      { t: 'pourquoi rejetee', w: 4 }, { t: 'fraude', w: 2 },
      { t: 'suspecte', w: 3 }, { t: 'suspicious', w: 3 },
      { t: 'indicateurs', w: 3 }, { t: 'pourquoi ma transaction', w: 4 },
    ],
  },
  {
    intent: 'pending_actions',
    terms: [
      { t: 'en attente', w: 3 }, { t: 'a verifier', w: 4 }, { t: 'verification', w: 2 },
      { t: 'a confirmer', w: 4 }, { t: 'dois-je confirmer', w: 4 },
      { t: 'pending', w: 3 }, { t: 'bloquee', w: 2 }, { t: 'attente de revision', w: 4 },
    ],
  },
  {
    intent: 'transaction_status',
    terms: [
      { t: 'statut', w: 3 }, { t: 'status', w: 3 }, { t: 'etat de la transaction', w: 4 },
      { t: 'ou en est', w: 4 }, { t: 'suivi', w: 2 }, { t: 'reference', w: 2 },
    ],
  },
  {
    intent: 'recent_transactions',
    terms: [
      { t: 'transactions', w: 2 }, { t: 'operations', w: 2 }, { t: 'historique', w: 3 },
      { t: 'dernieres', w: 2 }, { t: 'recentes', w: 2 }, { t: 'recent', w: 2 },
      { t: 'liste de mes', w: 2 }, { t: 'activite', w: 2 },
    ],
  },
  {
    intent: 'dispute',
    terms: [
      { t: 'litige', w: 4 }, { t: 'dispute', w: 4 }, { t: 'contestation', w: 4 },
      { t: 'contester', w: 4 }, { t: 'je ne reconnais pas', w: 4 },
      { t: 'pas autorise', w: 3 }, { t: 'frauduleuse', w: 3 },
    ],
  },
  {
    intent: 'faq_fees',
    terms: [
      { t: 'frais', w: 4 }, { t: 'fees', w: 4 }, { t: 'tarif', w: 3 },
      { t: 'commission', w: 3 }, { t: 'cout', w: 2 }, { t: 'combien ca coute', w: 4 },
    ],
  },
  {
    intent: 'faq_limits',
    terms: [
      { t: 'limite', w: 4 }, { t: 'limites', w: 4 }, { t: 'plafond', w: 4 },
      { t: 'limits', w: 4 }, { t: 'maximum', w: 2 }, { t: 'montant maximal', w: 4 },
    ],
  },
  {
    intent: 'faq_fraud',
    terms: [
      { t: 'detection de fraude', w: 5 }, { t: 'fraud detection', w: 5 },
      { t: 'comment fonctionne', w: 2 }, { t: 'moteur de fraude', w: 5 },
      { t: 'score de risque', w: 2 }, { t: 'protegez-vous', w: 2 },
    ],
  },
  {
    intent: 'faq_security',
    terms: [
      { t: 'securite', w: 3 }, { t: 'securiser', w: 3 }, { t: 'mot de passe', w: 3 },
      { t: 'piratage', w: 3 }, { t: 'proteger mon compte', w: 4 }, { t: 'security', w: 3 },
    ],
  },
  {
    intent: 'faq_contact',
    terms: [
      { t: 'contact', w: 3 }, { t: 'contacter', w: 3 }, { t: 'agence', w: 3 },
      { t: 'horaires', w: 3 }, { t: 'joindre', w: 3 }, { t: 'telephone', w: 2 },
      { t: 'conseiller', w: 3 }, { t: 'appeler', w: 2 },
    ],
  },
];

/** Expressions régulières d'intention (prioritaires sur les mots-clés). */
const REGEXES: { intent: Intent; re: RegExp }[] = [
  { intent: 'transaction_status', re: /tx[-\s]?\d{4}[-\s]?\d{3,}/i },
  { intent: 'balance', re: /quel (est )?mon solde|mon solde (est|s il)/i },
];

const TYPE_WORDS: Record<string, NluResult['txType']> = {
  depot: 'DEPOSIT', depots: 'DEPOSIT', deposit: 'DEPOSIT', deposits: 'DEPOSIT',
  retrait: 'WITHDRAWAL', retraits: 'WITHDRAWAL', withdrawal: 'WITHDRAWAL',
  virement: 'TRANSFER', virements: 'TRANSFER', transfer: 'TRANSFER', transfers: 'TRANSFER',
  paiement: 'PAYMENT', paiements: 'PAYMENT', payment: 'PAYMENT', payments: 'PAYMENT',
};

/** Extrait une référence de transaction (format TX-2026-123456). */
export function extractReference(raw: string): string | null {
  const m = raw.match(/TX[-\s]?\d{4}[-\s]?\d{3,}/i);
  if (m) {
    return m[0].toUpperCase().replace(/\s/g, '').replace(/TX(\d{4})(\d+)/, 'TX-$1-$2');
  }
  return null;
}

/** Détecte l'intention dominante d'un message utilisateur. */
export function detectIntent(raw: string): NluResult {
  const text = normalize(raw);
  const reference = extractReference(raw);
  let txType: NluResult['txType'] = null;
  for (const word of text.split(' ')) {
    if (TYPE_WORDS[word]) {
      txType = TYPE_WORDS[word];
      break;
    }
  }

  // Expressions régulières prioritaires (une référence explicite = demande de statut,
  // sauf si le message parle de risque/blocage → explication de fraude).
  for (const { intent, re } of REGEXES) {
    if (re.test(text)) {
      let resolved = intent;
      if (reference && intent === 'transaction_status' && /risque|risk|pourquoi|bloqu|suspend|rejet|attente/.test(text)) {
        resolved = 'transaction_risk';
      }
      return { intent: resolved, reference, txType, confidence: 0.95 };
    }
  }

  const scores = new Map<Intent, number>();
  for (const rule of RULES) {
    let score = 0;
    for (const { t, w } of rule.terms) {
      if (t.includes(' ')) {
        if (text.includes(t)) score += w;
      } else {
        const re = new RegExp(`(^| )${t.replace(/[-]/g, '[- ]')}( |$|s,)`, 'i');
        if (re.test(text) || text.includes(t)) score += w;
      }
    }
    if (score > 0) scores.set(rule.intent, Math.max(score, scores.get(rule.intent) || 0));
  }

  if (scores.size === 0) {
    return { intent: 'fallback', reference, txType, confidence: 0 };
  }

  // Priorités en cas d'égalité : les intentions spécifiques gagnent.
  const priority: Intent[] = [
    'transaction_risk', 'transaction_status', 'pending_actions', 'balance',
    'dispute', 'recent_transactions', 'faq_fraud', 'faq_fees', 'faq_limits',
    'faq_security', 'faq_contact', 'help', 'thanks', 'goodbye', 'greeting',
  ];
  const best = [...scores.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return priority.indexOf(a[0]) - priority.indexOf(b[0]);
  })[0];

  return { intent: best[0], reference, txType, confidence: Math.min(1, best[1] / 8) };
}
