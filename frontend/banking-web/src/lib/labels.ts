/** Libellés français + couleurs par statut (design system FinGuard). */

export const TX_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
  TRANSFER: 'Virement',
  PAYMENT: 'Paiement',
};

export const TX_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours de traitement',
  COMPLETED: 'Terminée',
  FAILED: 'Échouée',
  REJECTED: 'Rejetée',
  UNDER_REVIEW: 'En attente de révision',
  CANCELLED: 'Annulée',
};

export const RISK_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyen',
  HIGH: 'Élevé',
};

export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Soumis',
  UNDER_REVIEW: "En cours d'examen",
  INVESTIGATING: 'En cours d’investigation',
  RESOLVED: 'Résolu',
  REJECTED: 'Rejeté',
  CLOSED: 'Clos',
};

export const ALERT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouverte',
  UNDER_REVIEW: 'En examen',
  RESOLVED: 'Résolue',
  ESCALATED: 'Escaladée',
};

export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  FROZEN: 'Gelé',
  CLOSED: 'Fermé',
};

export const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  EMPLOYEE: 'Employé',
  ADMIN: 'Administrateur',
};

export const NOTIF_TYPE_LABELS: Record<string, string> = {
  TRANSACTION_SUCCESS: 'Succès',
  TRANSACTION_FAILED: 'Échec',
  FRAUD_ALERT: 'Alerte fraude',
  VERIFICATION_REQUEST: 'Vérification',
  SECURITY_ALERT: 'Sécurité',
  DISPUTE_UPDATE: 'Litige',
  SYSTEM: 'Système',
};

/** Classes de badges par statut de transaction. */
export const TX_STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PROCESSING: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  UNDER_REVIEW: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  FAILED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export const RISK_STYLES: Record<string, string> = {
  LOW: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  HIGH: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export const RISK_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f43f5e',
};

export const DISPUTE_STATUS_STYLES: Record<string, string> = {
  SUBMITTED: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  INVESTIGATING: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export const ALERT_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ESCALATED: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20',
};

export const ACCOUNT_STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  FROZEN: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};
