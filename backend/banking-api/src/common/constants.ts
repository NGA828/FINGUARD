/** Constantes métier Shield. */

export const ROLES = ['CLIENT', 'EMPLOYEE', 'ADMIN'] as const;
export const ACCOUNT_STATUSES = ['ACTIVE', 'FROZEN', 'CLOSED'] as const;
export const TX_TYPES = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT'] as const;
export const TX_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'UNDER_REVIEW',
  'CANCELLED',
] as const;
export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const FRAUD_ACTIONS = ['AUTHORIZE', 'VERIFY', 'HOLD'] as const;
export const ALERT_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED'] as const;
export const ALERT_RESOLUTIONS = ['APPROVED', 'REJECTED', 'HELD', 'ESCALATED'] as const;
export const DISPUTE_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'INVESTIGATING',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
] as const;
export const NOTIFICATION_TYPES = [
  'TRANSACTION_SUCCESS',
  'TRANSACTION_FAILED',
  'FRAUD_ALERT',
  'VERIFICATION_REQUEST',
  'SECURITY_ALERT',
  'DISPUTE_UPDATE',
  'SYSTEM',
] as const;

export const CONFIG_KEYS = {
  MEDIUM_RISK_THRESHOLD: '30',
  HIGH_RISK_THRESHOLD: '60',
  GLOBAL_PER_TX_LIMIT: '5000000',
  GLOBAL_DAILY_LIMIT: '10000000',
  NOTIFY_EMPLOYEES_ON_HIGH: '1',
};

export const CONFIG_DESCRIPTIONS: Record<string, { description: string; category: string }> = {
  MEDIUM_RISK_THRESHOLD: {
    description: 'Score de risque (0-100) à partir duquel une transaction exige une vérification supplémentaire',
    category: 'FRAUDE',
  },
  HIGH_RISK_THRESHOLD: {
    description: "Score de risque (0-100) à partir duquel une transaction est mise en attente et signalée",
    category: 'FRAUDE',
  },
  GLOBAL_PER_TX_LIMIT: {
    description: 'Montant maximal autorisé par transaction (XAF), tous comptes confondus',
    category: 'LIMITES',
  },
  GLOBAL_DAILY_LIMIT: {
    description: 'Volume maximal quotidien de sortie par compte (XAF)',
    category: 'LIMITES',
  },
  NOTIFY_EMPLOYEES_ON_HIGH: {
    description: "Notifier les employés lors d'une transaction à haut risque (1 = oui, 0 = non)",
    category: 'NOTIFICATIONS',
  },
};

export interface FraudRuleSeed {
  code: string;
  name: string;
  description: string;
  points: number;
  threshold: number | null;
  param: string | null;
}

export const DEFAULT_FRAUD_RULES: FraudRuleSeed[] = [
  {
    code: 'VERY_LARGE_AMOUNT',
    name: 'Montant exceptionnellement élevé',
    description: 'Le montant de la transaction dépasse un seuil exceptionnel.',
    points: 40,
    threshold: 2000000,
    param: null,
  },
  {
    code: 'LARGE_AMOUNT',
    name: 'Montant élevé',
    description: 'Le montant de la transaction dépasse un seuil élevé.',
    points: 25,
    threshold: 1000000,
    param: null,
  },
  {
    code: 'UNUSUAL_VS_HISTORY',
    name: 'Montant inhabituel par rapport à l’historique',
    description:
      'Le montant dépasse un multiple du montant moyen des dernières transactions du client.',
    points: 30,
    threshold: 4,
    param: 'history:10',
  },
  {
    code: 'HIGH_VELOCITY',
    name: 'Fréquence de transactions élevée',
    description: 'Plusieurs transactions initiées sur une très courte période.',
    points: 20,
    threshold: 4,
    param: 'window_minutes:10',
  },
  {
    code: 'ODD_HOURS',
    name: 'Transaction en heures creuses',
    description: 'Transaction initiée entre 00h00 et 05h00.',
    points: 15,
    threshold: null,
    param: null,
  },
  {
    code: 'LARGE_BALANCE_RATIO',
    name: 'Part importante du solde',
    description: 'Le montant représente une part importante du solde du compte (sortie).',
    points: 20,
    threshold: 70,
    param: null,
  },
  {
    code: 'NEW_BENEFICIARY',
    name: 'Nouveau bénéficiaire',
    description: 'Virement vers un compte bénéficiaire jamais utilisé auparavant.',
    points: 10,
    threshold: null,
    param: null,
  },
  {
    code: 'DAILY_VOLUME_HIGH',
    name: 'Volume quotidien proche de la limite',
    description: 'Le cumul des transactions du jour approche la limite quotidienne du compte.',
    points: 10,
    threshold: 80,
    param: null,
  },
];
