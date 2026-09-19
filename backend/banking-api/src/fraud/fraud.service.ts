import { Injectable } from '@nestjs/common';
import {
  accounts,
  fraudAnalyses,
  fraudAlerts,
  fraudRules,
  query,
  systemConfig,
  transactions,
} from '../database/connection';
import { nowIso, uuid } from '../common/utils';
import { DEFAULT_FRAUD_RULES } from '../common/constants';
import { LlmService } from '../assistant/llm.service';

export interface FraudIndicator {
  code: string;
  label: string;
  points: number;
  detail?: string;
}

export interface FraudResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  action: 'AUTHORIZE' | 'VERIFY' | 'HOLD';
  indicators: FraudIndicator[];
  summary: string;
  aiAssessment?: { riskAdjustment: number; reason: string };
}

/**
 * Moteur intelligent de détection de fraude de Shield.
 *
 * Approche hybride (conforme au cahier des charges §26) :
 *  - règles backend configurables par l'administrateur (table fraud_rules) ;
 *  - analyse contextuelle : montant, fréquence, historique du client,
 *    heure, solde, bénéficiaires connus, volume quotidien ;
 *  - seuils de classification pilotés par system_config.
 */
@Injectable()
export class FraudService {
  constructor(private readonly llm: LlmService) {}

  /** Analyse une transaction et retourne l'évaluation de risque. */
  analyze(tx: any, account: any): FraudResult {
    const rules = fraudRules.all('is_active = 1');
    const cfg = this.config();
    const indicators: FraudIndicator[] = [];
    let score = 0;
    const add = (rule: any, detail?: string) => {
      score += rule.points;
      indicators.push({ code: rule.code, label: rule.name, points: rule.points, detail });
    };

    const amount = Number(tx.amount);
    const isOutgoing = ['WITHDRAWAL', 'TRANSFER', 'PAYMENT'].includes(tx.type);
    const rule = (code: string) => rules.find((r: any) => r.code === code);

    // 1. Montant exceptionnellement élevé
    const veryLarge = rule('VERY_LARGE_AMOUNT');
    if (veryLarge?.threshold && amount >= Number(veryLarge.threshold)) add(veryLarge);

    // 2. Montant élevé
    const large = rule('LARGE_AMOUNT');
    if (large?.threshold && amount >= Number(large.threshold) && !indicators.find((i) => i.code === 'VERY_LARGE_AMOUNT')) {
      add(large);
    }

    // 3. Montant inhabituel vs historique du client
    const unusual = rule('UNUSUAL_VS_HISTORY');
    if (unusual) {
      const historySize = Number(unusual.param?.split(':')[1] || 10);
      const rows = query(
        `SELECT amount FROM transactions
         WHERE source_account_id = ? AND status = 'COMPLETED'
         ORDER BY created_at DESC LIMIT ?`,
        [account.id, historySize],
      );
      if (rows.length >= 3) {
        const avg = rows.reduce((s: number, r: any) => s + Number(r.amount), 0) / rows.length;
        const multiplier = Number(unusual.threshold || 4);
        if (avg > 0 && amount > avg * multiplier) {
          add(unusual, `Montant moyen récent : ${Math.round(avg).toLocaleString('fr-FR')} XAF`);
        }
      }
    }

    // 4. Fréquence élevée (vélocité)
    const velocity = rule('HIGH_VELOCITY');
    if (velocity) {
      const windowMinutes = Number(velocity.param?.split(':')[1] || 10);
      const maxCount = Number(velocity.threshold || 4);
      const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
      const recentCount = transactions.count(
        'source_account_id = ? AND created_at >= ?',
        [account.id, since],
      );
      if (recentCount + 1 >= maxCount) {
        add(velocity, `${recentCount + 1} transactions en ${windowMinutes} minutes`);
      }
    }

    // 5. Heures creuses (00h - 05h)
    const odd = rule('ODD_HOURS');
    if (odd) {
      const hour = new Date().getHours();
      if (hour >= 0 && hour < 5) add(odd, `Transaction initiée à ${hour}h`);
    }

    // 6. Part importante du solde (sorties)
    const balanceRatio = rule('LARGE_BALANCE_RATIO');
    if (balanceRatio && isOutgoing && Number(account.balance) > 0) {
      const pct = (amount / Number(account.balance)) * 100;
      if (pct >= Number(balanceRatio.threshold || 70)) {
        add(balanceRatio, `${pct.toFixed(0)} % du solde`);
      }
    }

    // 7. Nouveau bénéficiaire (virement)
    const newBene = rule('NEW_BENEFICIARY');
    if (newBene && tx.type === 'TRANSFER' && tx.targetAccountId) {
      const past = transactions.count(
        "source_account_id = ? AND target_account_id = ? AND status = 'COMPLETED'",
        [account.id, tx.targetAccountId],
      );
      if (past === 0) add(newBene);
    }

    // 8. Volume quotidien proche de la limite
    const daily = rule('DAILY_VOLUME_HIGH');
    if (daily && isOutgoing) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const spentToday = transactions.sum(
        'amount',
        "source_account_id = ? AND created_at >= ? AND status IN ('COMPLETED','PENDING','PROCESSING','UNDER_REVIEW')",
        [account.id, startOfDay.toISOString()],
      );
      const limit = Number(account.dailyLimit);
      const pct = limit > 0 ? ((spentToday + amount) / limit) * 100 : 0;
      if (pct >= Number(daily.threshold || 80)) {
        add(daily, `${pct.toFixed(0)} % de la limite quotidienne`);
      }
    }

    score = Math.min(100, score);
    const { level, action } = this.classify(score, cfg);

    const summary = this.buildSummary(level, action, indicators);
    return { riskScore: score, riskLevel: level, action, indicators, summary };
  }

  async analyzeWithAi(tx: any, account: any): Promise<FraudResult> {
    const base = this.analyze(tx, account);
    const recentTransactionCount = transactions.count(
      'source_account_id = ? AND created_at >= ?',
      [account.id, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
    );
    const assessment = await this.llm.assessFraud({
      type: tx.type,
      amount: Number(tx.amount),
      beneficiaryName: tx.beneficiaryName,
      paymentMethod: tx.paymentMethod,
      paymentPhone: tx.paymentPhone,
      accountBalance: Number(account.balance),
      dailyLimit: Number(account.dailyLimit),
      recentTransactionCount,
    });
    if (!assessment) return base;

    const score = Math.min(100, base.riskScore + assessment.riskAdjustment);
    const cfg = this.config();
    const { level, action } = this.classify(score, cfg);
    const indicator = {
      code: 'AI_CONTEXTUAL_RISK',
      label: 'Analyse contextuelle IA',
      points: assessment.riskAdjustment,
      detail: assessment.reason,
    };
    const indicators = assessment.riskAdjustment > 0 ? [...base.indicators, indicator] : base.indicators;
    return {
      ...base,
      riskScore: score,
      riskLevel: level,
      action,
      indicators,
      summary: this.buildSummary(level, action, indicators),
      aiAssessment: assessment,
    };
  }

  persist(txId: string, result: FraudResult) {
    return fraudAnalyses.insert({
      id: uuid(),
      transactionId: txId,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      action: result.action,
      indicators: JSON.stringify(result.indicators),
      summary: result.summary,
      analyzedAt: nowIso(),
    });
  }

  forTransaction(txId: string) {
    const analysis = fraudAnalyses.first('transaction_id = ?', [txId]);
    if (!analysis) return null;
    return { ...analysis, indicators: JSON.parse(analysis.indicators || '[]') };
  }

  private config() {
    const rows = systemConfig.all();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return {
      mediumThreshold: Number(map.MEDIUM_RISK_THRESHOLD ?? 30),
      highThreshold: Number(map.HIGH_RISK_THRESHOLD ?? 60),
    };
  }

  private classify(score: number, cfg: { mediumThreshold: number; highThreshold: number }) {
    if (score >= cfg.highThreshold) return { level: 'HIGH' as const, action: 'HOLD' as const };
    if (score >= cfg.mediumThreshold) return { level: 'MEDIUM' as const, action: 'VERIFY' as const };
    return { level: 'LOW' as const, action: 'AUTHORIZE' as const };
  }

  private buildSummary(level: string, action: string, indicators: FraudIndicator[]) {
    if (level === 'LOW') return 'Transaction conforme au comportement habituel du client.';
    const reasons = indicators.map((i) => i.label.toLowerCase()).join(', ');
    if (level === 'HIGH') {
      return `Forte probabilité de fraude (${reasons}). Mise en attente et signalement.`;
    }
    return `Caractéristiques suspectes (${reasons}). Vérification supplémentaire requise.`;
  }

  // ---------------------------------------------------------------------
  // Statistiques fraude (tableaux de bord employé / administrateur)
  // ---------------------------------------------------------------------

  stats() {
    const byLevel = query(
      `SELECT risk_level, COUNT(*) AS c FROM fraud_analyses GROUP BY risk_level`,
    );
    const totalAnalyses = fraudAnalyses.count();
    const openAlerts = fraudAlerts.count("status IN ('OPEN','UNDER_REVIEW')");
    const escalated = fraudAlerts.count('escalated_to_admin = 1');
    const avgScore = (query('SELECT AVG(risk_score) AS s FROM fraud_analyses')[0] as any)?.s ?? 0;
    const flagged = query(
      `SELECT COUNT(*) AS c FROM fraud_analyses WHERE risk_level IN ('MEDIUM','HIGH')`,
    )[0] as any;

    // Tendance 14 derniers jours
    const trend = query(
      `SELECT DATE(analyzed_at) AS d, risk_level, COUNT(*) AS c
       FROM fraud_analyses
       WHERE analyzed_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
       GROUP BY DATE(analyzed_at), risk_level
       ORDER BY d ASC`,
    );

    return {
      totalAnalyses,
      flaggedCount: flagged?.c ?? 0,
      openAlerts,
      escalated,
      avgScore: Math.round(avgScore),
      byLevel: {
        LOW: Number(byLevel.find((r: any) => r.risk_level === 'LOW')?.c ?? 0),
        MEDIUM: Number(byLevel.find((r: any) => r.risk_level === 'MEDIUM')?.c ?? 0),
        HIGH: Number(byLevel.find((r: any) => r.risk_level === 'HIGH')?.c ?? 0),
      },
      trend,
    };
  }

  cases(filters: { status?: string; level?: string }) {
    const where: string[] = [];
    const params: any[] = [];
    if (filters.status) {
      where.push('fa.status = ?');
      params.push(filters.status);
    }
    if (filters.level) {
      where.push('fa.level = ?');
      params.push(filters.level);
    }
    const rows = query(
      `SELECT fa.*, t.reference AS tx_reference, t.type AS tx_type, t.amount AS tx_amount,
              t.status AS tx_status, t.created_at AS tx_created_at,
              a.account_number, u.first_name, u.last_name
       FROM fraud_alerts fa
       JOIN transactions t ON t.id = fa.transaction_id
       LEFT JOIN accounts a ON a.id = t.source_account_id
       LEFT JOIN customers c ON c.id = a.customer_id
       LEFT JOIN users u ON u.id = c.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY fa.created_at DESC
       LIMIT 200`,
      params,
    ).map((r: any) => ({
      ...r,
      escalatedToAdmin: !!r.escalated_to_admin,
      txAmount: Number(r.tx_amount ?? r.txAmount),
      customerName: r.first_name ? `${r.first_name} ${r.last_name}` : null,
    }));
    return rows;
  }
}
