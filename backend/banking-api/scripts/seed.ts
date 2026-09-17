/**
 * Seed Shield — données de démonstration réalistes :
 * administrateur, employés, clients, comptes, historique de transactions,
 * cas de fraude (scénario du cahier des charges §29), litiges,
 * notifications, journaux d'audit, configuration et règles de fraude.
 */
import * as bcrypt from 'bcryptjs';
import { resetDatabase, tx } from '../src/database/connection';
import {
  accounts,
  auditLogs,
  beneficiaries,
  customers,
  disputeNotes,
  disputes,
  employees,
  fraudAlerts,
  fraudAnalyses,
  fraudRules,
  notifications,
  systemConfig,
  transactions,
  users,
} from '../src/database/connection';
import { DEFAULT_FRAUD_RULES, CONFIG_KEYS, CONFIG_DESCRIPTIONS } from '../src/common/constants';
import { accountNumber, daysAgoIso, nowIso, uuid } from '../src/common/utils';

const iso = (daysAgo: number, hour: number, minute = 0) => daysAgoIso(daysAgo, hour, minute);

let accountSeq = 0;

function makeUser(role: string, email: string, password: string, firstName: string, lastName: string, phone: string, createdAt: string) {
  return users.insert({
    id: uuid(),
    email,
    password: bcrypt.hashSync(password, 10),
    firstName,
    lastName,
    phone,
    role,
    isActive: true,
    lastLoginAt: iso(0, 8),
    createdAt,
    updatedAt: createdAt,
  });
}

function makeCustomer(userId: string, opts: { address?: string; city?: string } = {}, createdAt = iso(60, 10)) {
  return customers.insert({
    id: uuid(),
    userId,
    address: opts.address ?? null,
    city: opts.city ?? null,
    country: 'Cameroun',
    isActive: true,
    createdAt,
  });
}

function makeAccount(customerId: string, balance: number, status = 'ACTIVE', opts: any = {}) {
  accountSeq += 1;
  return accounts.insert({
    id: uuid(),
    accountNumber: accountNumber(10000100 + accountSeq),
    customerId,
    balance,
    status,
    dailyLimit: opts.dailyLimit ?? 5000000,
    perTxLimit: opts.perTxLimit ?? 2000000,
    frozenReason: opts.frozenReason ?? null,
    openedAt: opts.openedAt ?? iso(60, 10),
    frozenAt: opts.frozenAt ?? null,
  });
}

interface SeedTx {
  accountId: string;
  type: string;
  amount: number;
  daysAgo: number;
  hour: number;
  minute?: number;
  status?: string;
  riskLevel?: string;
  riskScore?: number;
  targetAccountId?: string;
  beneficiaryName?: string;
  description?: string;
  statusReason?: string;
  requiresVerification?: boolean;
}

function makeTx(t: SeedTx) {
  const createdAt = iso(t.daysAgo, t.hour, t.minute ?? 0);
  const isDeposit = t.type === 'DEPOSIT';
  const completedAt = t.status === 'COMPLETED' ? createdAt : null;
  return transactions.insert({
    id: uuid(),
    reference: `TX-${new Date(createdAt).getFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`,
    type: t.type,
    status: t.status ?? 'COMPLETED',
    amount: Math.round(t.amount),
    sourceAccountId: isDeposit ? null : t.accountId,
    targetAccountId: isDeposit ? t.accountId : t.targetAccountId ?? null,
    beneficiaryName: t.beneficiaryName ?? null,
    description: t.description ?? null,
    externalReference: completedAt ? `EXT-${uuid().slice(0, 8).toUpperCase()}` : null,
    requiresVerification: t.requiresVerification ?? false,
    statusReason: t.statusReason ?? null,
    riskScore: t.riskScore ?? 0,
    riskLevel: t.riskLevel ?? 'LOW',
    createdByUserId: null,
    reviewedByUserId: null,
    createdAt,
    updatedAt: createdAt,
    completedAt,
  });
}

function makeAnalysis(txId: string, score: number, level: string, action: string, indicators: any[], summary: string, analyzedAt: string) {
  return fraudAnalyses.insert({
    id: uuid(),
    transactionId: txId,
    riskScore: score,
    riskLevel: level,
    action,
    indicators: JSON.stringify(indicators),
    summary,
    analyzedAt,
  });
}

function notify(userId: string, type: string, title: string, message: string, txId?: string, createdAt = nowIso()) {
  notifications.insert({
    id: uuid(),
    userId,
    type,
    title,
    message,
    transactionId: txId ?? null,
    isRead: false,
    createdAt,
  });
}

function audit(action: string, opts: { userId?: string; entity?: string; entityId?: string; description?: string; createdAt?: string } = {}) {
  auditLogs.insert({
    id: uuid(),
    userId: opts.userId ?? null,
    action,
    entity: opts.entity ?? null,
    entityId: opts.entityId ?? null,
    description: opts.description ?? null,
    ip: '196.207.14.88',
    userAgent: 'Mozilla/5.0 (FinGuard Web)',
    createdAt: opts.createdAt ?? nowIso(),
  });
}

async function main() {
  console.log('🌱 Seed FinGuard : réinitialisation de la base...');
  resetDatabase();

  tx(() => {
    // ---------------------------------------------------------------
    // Configuration système
    // ---------------------------------------------------------------
    for (const [key, value] of Object.entries(CONFIG_KEYS)) {
      const meta = CONFIG_DESCRIPTIONS[key] || { description: '', category: 'GENERAL' };
      systemConfig.insert({
        key,
        value,
        description: meta.description,
        category: meta.category,
        updatedAt: nowIso(),
      });
    }
    for (const rule of DEFAULT_FRAUD_RULES) {
      fraudRules.insert({ id: uuid(), ...rule, isActive: true, updatedAt: nowIso() });
    }

    // ---------------------------------------------------------------
    // Utilisateurs
    // ---------------------------------------------------------------
    const admin = makeUser('ADMIN', 'admin@finguard.com', 'Admin123!', 'Serge', 'Onana', '+237 6 99 00 00 01', iso(120, 9));
    employees.insert({ id: uuid(), userId: admin.id, position: 'Administrateur système', department: 'Direction des systèmes d’information', hiredAt: iso(120, 9) });

    const emp1 = makeUser('EMPLOYEE', 'marie.kouassi@finguard.com', 'Employe123!', 'Marie', 'Kouassi', '+237 6 99 11 22 33', iso(100, 9));
    employees.insert({ id: uuid(), userId: emp1.id, position: 'Chargée des opérations', department: 'Opérations bancaires', hiredAt: iso(100, 9) });
    const emp2 = makeUser('EMPLOYEE', 'emmanuel.njoya@finguard.com', 'Employe123!', 'Emmanuel', 'Njoya', '+237 6 77 44 55 66', iso(90, 9));
    employees.insert({ id: uuid(), userId: emp2.id, position: 'Chargé de conformité', department: 'Conformité et risques', hiredAt: iso(90, 9) });

    // Clients
    const cJeanUser = makeUser('CLIENT', 'client@demo.com', 'Client123!', 'Jean', 'Kamga', '+237 6 55 10 20 30', iso(90, 10));
    const cJean = makeCustomer(cJeanUser.id, { address: 'Rue 1.839, Akwa', city: 'Douala' }, iso(90, 10));
    const acctJean = makeAccount(cJean.id, 1250000, 'ACTIVE', { openedAt: iso(90, 11) });

    const cAminaUser = makeUser('CLIENT', 'amina.ndong@demo.com', 'Client123!', 'Amina', 'Ndong', '+237 6 51 87 45 12', iso(110, 10));
    const cAmina = makeCustomer(cAminaUser.id, { address: 'Quartier Bastos', city: 'Yaoundé' }, iso(110, 10));
    const acctAmina = makeAccount(cAmina.id, 3420000, 'ACTIVE', { openedAt: iso(110, 11) });

    const cPaulUser = makeUser('CLIENT', 'paul.essomba@demo.com', 'Client123!', 'Paul', 'Essomba', '+237 6 96 32 11 08', iso(80, 10));
    const cPaul = makeCustomer(cPaulUser.id, { city: 'Douala' }, iso(80, 10));
    const acctPaul = makeAccount(cPaul.id, 780000, 'ACTIVE', { openedAt: iso(80, 11) });

    const cClarisseUser = makeUser('CLIENT', 'clarisse.mefou@demo.com', 'Client123!', 'Clarisse', 'Mefou', '+237 6 90 22 87 43', iso(70, 10));
    const cClarisse = makeCustomer(cClarisseUser.id, { city: 'Yaoundé' }, iso(70, 10));
    const acctClarisse = makeAccount(cClarisse.id, 215000, 'ACTIVE', { openedAt: iso(70, 11) });

    const cIbrahimUser = makeUser('CLIENT', 'ibrahim.sali@demo.com', 'Client123!', 'Ibrahim', 'Sali', '+237 6 53 90 71 25', iso(65, 10));
    const cIbrahim = makeCustomer(cIbrahimUser.id, { city: 'Garoua' }, iso(65, 10));
    const acctIbrahim = makeAccount(cIbrahim.id, 95000, 'FROZEN', {
      openedAt: iso(65, 11),
      frozenAt: iso(2, 15),
      frozenReason: 'Suspicion de fraude — enquête en cours',
    });

    const cNadegeUser = makeUser('CLIENT', 'nadege.tchoua@demo.com', 'Client123!', 'Nadège', 'Tchoua', '+237 6 97 65 40 21', iso(50, 10));
    const cNadege = makeCustomer(cNadegeUser.id, { city: 'Bafoussam' }, iso(50, 10));
    const acctNadege = makeAccount(cNadege.id, 640000, 'ACTIVE', { openedAt: iso(50, 11) });

    const cRodrigueUser = makeUser('CLIENT', 'rodrigue.mbarga@demo.com', 'Client123!', 'Rodrigue', 'Mbarga', '+237 6 54 28 93 77', iso(40, 10));
    const cRodrigue = makeCustomer(cRodrigueUser.id, { city: 'Kribi' }, iso(40, 10));
    const acctRodrigue = makeAccount(cRodrigue.id, 480000, 'ACTIVE', { openedAt: iso(40, 11) });

    const cEstelleUser = makeUser('CLIENT', 'estelle.fouda@demo.com', 'Client123!', 'Estelle', 'Fouda', '+237 6 91 73 55 02', iso(30, 10));
    const cEstelle = makeCustomer(cEstelleUser.id, { city: 'Douala' }, iso(30, 10));
    const acctEstelle = makeAccount(cEstelle.id, 1730000, 'ACTIVE', { openedAt: iso(30, 11) });

    // Bénéficiaires enregistrés par Jean Kamga (client de démonstration).
    for (const b of [
      { name: 'Amina Ndong', account: acctAmina.accountNumber, bankLabel: 'FINGUARD' },
      { name: 'Paul Essomba', account: acctPaul.accountNumber, bankLabel: 'FINGUARD' },
      { name: 'Loyer Akwa — SCI Douala', account: acctEstelle.accountNumber, bankLabel: 'FINGUARD' },
    ]) {
      beneficiaries.insert({
        id: uuid(),
        customerId: cJean.id,
        name: b.name,
        accountNumber: b.account,
        bankLabel: b.bankLabel,
        createdAt: iso(45, 9),
      });
    }

    // ---------------------------------------------------------------
    // Historique de Jean Kamga (profil habituel : 5 000 – 150 000 XAF)
    // ---------------------------------------------------------------
    const jeanHistory = [
      [29, 9, 45000], [27, 14, 12000], [26, 10, 80000], [24, 17, 25000], [22, 11, 60000],
      [21, 15, 95000], [19, 9, 15000], [18, 12, 50000], [16, 16, 32000], [15, 10, 75000],
      [13, 14, 5000], [12, 11, 120000], [10, 9, 40000], [9, 15, 65000], [7, 10, 28000],
      [6, 13, 55000], [4, 16, 90000], [3, 9, 18000], [2, 14, 47000], [1, 10, 35000],
    ] as const;
    for (const [d, h, amount] of jeanHistory) {
      const type = d % 3 === 0 ? 'WITHDRAWAL' : d % 3 === 1 ? 'PAYMENT' : 'TRANSFER';
      makeTx({
        accountId: acctJean.id,
        type,
        amount,
        daysAgo: d,
        hour: h,
        beneficiaryName: type === 'PAYMENT' ? 'Supermarché Santa Lucia' : undefined,
        targetAccountId: type === 'TRANSFER' ? acctNadege.id : undefined,
        description: type === 'TRANSFER' ? 'Virement familial' : undefined,
      });
    }
    // Dépôts de salaire
    makeTx({ accountId: acctJean.id, type: 'DEPOSIT', amount: 850000, daysAgo: 25, hour: 8, description: 'Salaire — SABC' });
    makeTx({ accountId: acctJean.id, type: 'DEPOSIT', amount: 850000, daysAgo: 2, hour: 8, description: 'Salaire — SABC' });

    // SCÉNARIO §29 : virement exceptionnel de 2 000 000 XAF → HAUT RISQUE
    const bigTx = makeTx({
      accountId: acctJean.id,
      type: 'TRANSFER',
      amount: 2000000,
      daysAgo: 1,
      hour: 18,
      minute: 42,
      status: 'UNDER_REVIEW',
      riskLevel: 'HIGH',
      riskScore: 85,
      targetAccountId: acctRodrigue.id,
      description: 'Virement urgent',
    });
    makeAnalysis(
      bigTx.id,
      85,
      'HIGH',
      'HOLD',
      [
        { code: 'VERY_LARGE_AMOUNT', label: 'Montant exceptionnellement élevé', points: 40 },
        { code: 'UNUSUAL_VS_HISTORY', label: 'Montant inhabituel par rapport à l’historique', points: 30, detail: 'Montant moyen récent : 49 850 XAF' },
        { code: 'LARGE_BALANCE_RATIO', label: 'Part importante du solde', points: 20, detail: '160 % du solde' },
      ],
      'Forte probabilité de fraude (montant exceptionnellement élevé, montant inhabituel par rapport à l’historique). Mise en attente et signalement.',
      iso(1, 18, 42),
    );
    fraudAlerts.insert({
      id: uuid(),
      transactionId: bigTx.id,
      accountId: acctJean.id,
      level: 'HIGH',
      status: 'OPEN',
      escalatedToAdmin: false,
      createdAt: iso(1, 18, 42),
    });
    notify(cJeanUser.id, 'FRAUD_ALERT', 'Alerte de sécurité', 'Votre virement de 2 000 000 XAF (réf. ' + bigTx.reference + ') présente un risque élevé et a été mis en attente pour examen.', bigTx.id, iso(1, 18, 43));
    notify(emp1.id, 'FRAUD_ALERT', 'Transaction suspecte à examiner', `Virement de 2 000 000 XAF — réf. ${bigTx.reference} (score de risque : 85/100).`, bigTx.id, iso(1, 18, 43));

    // Risque MOYEN : retrait de 450 000 XAF ce matin → vérification client
    const mediumTx = makeTx({
      accountId: acctJean.id,
      type: 'WITHDRAWAL',
      amount: 450000,
      daysAgo: 0,
      hour: 9,
      minute: 15,
      status: 'PENDING',
      riskLevel: 'MEDIUM',
      riskScore: 45,
      requiresVerification: true,
    });
    makeAnalysis(
      mediumTx.id,
      45,
      'MEDIUM',
      'VERIFY',
      [
        { code: 'LARGE_BALANCE_RATIO', label: 'Part importante du solde', points: 20, detail: '36 % du solde' },
        { code: 'UNUSUAL_VS_HISTORY', label: 'Montant inhabituel par rapport à l’historique', points: 30, detail: 'Montant moyen récent : 49 850 XAF' },
      ],
      'Caractéristiques suspectes (montant inhabituel). Vérification supplémentaire requise.',
      iso(0, 9, 15),
    );
    notify(cJeanUser.id, 'VERIFICATION_REQUEST', 'Vérification requise', `Un retrait de 450 000 XAF a été détecté depuis votre compte ${acctJean.accountNumber}. Veuillez confirmer si vous avez initié cette transaction.`, mediumTx.id, iso(0, 9, 15));

    // Paiement litigieux d'il y a 5 jours
    const litigTx = makeTx({
      accountId: acctJean.id,
      type: 'PAYMENT',
      amount: 75000,
      daysAgo: 5,
      hour: 20,
      minute: 12,
      beneficiaryName: 'Boutique en ligne KMall',
      description: 'Commande #88431',
    });
    const dispute1 = disputes.insert({
      id: uuid(),
      reference: 'DP-2026-1042',
      transactionId: litigTx.id,
      customerId: cJean.id,
      reason: 'Transaction non autorisée',
      description: 'Je n’ai jamais effectué cet achat en ligne. Ma carte était en ma possession.',
      status: 'INVESTIGATING',
      createdAt: iso(4, 10),
      updatedAt: iso(1, 16),
    });
    disputeNotes.insert({ id: uuid(), disputeId: dispute1.id, authorId: cJeanUser.id, content: 'Je confirme que je n’ai pas effectué ce paiement.', createdAt: iso(4, 10, 5) });
    disputeNotes.insert({ id: uuid(), disputeId: dispute1.id, authorId: emp1.id, content: 'Vérification du marchand en cours. Le bénéficiaire est un site de e-commerce connu. Demande de justificatifs envoyée au marchand.', createdAt: iso(2, 11) });
    disputeNotes.insert({ id: uuid(), disputeId: dispute1.id, authorId: emp2.id, content: 'Adresse IP du paiement différente des habitudes du client — investigation approfondie requise.', createdAt: iso(1, 16) });
    notify(cJeanUser.id, 'DISPUTE_UPDATE', 'Mise à jour de votre litige', `Votre litige ${dispute1.reference} est maintenant « En cours d’investigation ».`, litigTx.id, iso(1, 16));

    // ---------------------------------------------------------------
    // Amina Ndong : cas HAUT RISQUE escaladé à l'administration
    // ---------------------------------------------------------------
    for (let i = 0; i < 14; i++) {
      makeTx({ accountId: acctAmina.id, type: i % 2 ? 'TRANSFER' : 'PAYMENT', amount: 120000 + i * 45000, daysAgo: 30 - i * 2, hour: 10 + (i % 6), targetAccountId: i % 2 ? acctEstelle.id : undefined, beneficiaryName: i % 2 ? undefined : 'Fournisseur ETS Bella' });
      makeTx({ accountId: acctAmina.id, type: 'DEPOSIT', amount: 400000, daysAgo: 29 - i * 2, hour: 8, description: 'Recette commerciale' });
    }
    const aminaTx = makeTx({
      accountId: acctAmina.id,
      type: 'TRANSFER',
      amount: 1650000,
      daysAgo: 3,
      hour: 2,
      minute: 24,
      status: 'UNDER_REVIEW',
      riskLevel: 'HIGH',
      riskScore: 90,
      targetAccountId: acctIbrahim.id,
    });
    makeAnalysis(
      aminaTx.id,
      90,
      'HIGH',
      'HOLD',
      [
        { code: 'LARGE_AMOUNT', label: 'Montant élevé', points: 25 },
        { code: 'ODD_HOURS', label: 'Transaction en heures creuses', points: 15, detail: 'Transaction initiée à 2h' },
        { code: 'UNUSUAL_VS_HISTORY', label: 'Montant inhabituel par rapport à l’historique', points: 30 },
        { code: 'HIGH_VELOCITY', label: 'Fréquence de transactions élevée', points: 20 },
      ],
      'Forte probabilité de fraude. Mise en attente et signalement.',
      iso(3, 2, 24),
    );
    const aminaAlert = fraudAlerts.insert({
      id: uuid(),
      transactionId: aminaTx.id,
      accountId: acctAmina.id,
      level: 'HIGH',
      status: 'ESCALATED',
      resolution: 'ESCALATED',
      escalatedToAdmin: true,
      notes: 'Virement nocturne vers un compte gelé. Escalade à l’administration demandée.',
      createdAt: iso(3, 2, 24),
      resolvedAt: null,
    });
    notify(emp1.id, 'FRAUD_ALERT', 'Transaction suspecte à examiner', `Virement de 1 650 000 XAF — réf. ${aminaTx.reference} (score : 90/100).`, aminaTx.id, iso(3, 2, 25));
    notify(admin.id, 'SECURITY_ALERT', 'Cas de fraude escaladé', `Le cas ${aminaTx.reference} a été escaladé vers l'administration.`, aminaTx.id, iso(2, 9));

    // ---------------------------------------------------------------
    // Paul Essomba : transaction rejetée par un employé
    // ---------------------------------------------------------------
    for (let i = 0; i < 10; i++) {
      makeTx({ accountId: acctPaul.id, type: i % 2 ? 'WITHDRAWAL' : 'PAYMENT', amount: 20000 + i * 9000, daysAgo: 25 - i * 2, hour: 9 + (i % 8), beneficiaryName: i % 2 ? undefined : 'Pharmacie du Centre' });
    }
    const paulTx = makeTx({
      accountId: acctPaul.id,
      type: 'WITHDRAWAL',
      amount: 650000,
      daysAgo: 6,
      hour: 22,
      status: 'REJECTED',
      riskLevel: 'HIGH',
      riskScore: 75,
      statusReason: 'Rejetée après examen : client injoignable, profil de retrait inhabituel.',
    });
    makeAnalysis(
      paulTx.id,
      75,
      'HIGH',
      'HOLD',
      [
        { code: 'UNUSUAL_VS_HISTORY', label: 'Montant inhabituel par rapport à l’historique', points: 30 },
        { code: 'LARGE_BALANCE_RATIO', label: 'Part importante du solde', points: 20, detail: '83 % du solde' },
        { code: 'HIGH_VELOCITY', label: 'Fréquence de transactions élevée', points: 20 },
      ],
      'Forte probabilité de fraude. Mise en attente et signalement.',
      iso(6, 22),
    );
    fraudAlerts.insert({
      id: uuid(),
      transactionId: paulTx.id,
      accountId: acctPaul.id,
      level: 'HIGH',
      status: 'RESOLVED',
      resolution: 'REJECTED',
      notes: 'Client injoignable pendant 48h. Transaction rejetée par précaution.',
      assignedToId: emp1.id,
      createdAt: iso(6, 22),
      resolvedAt: iso(4, 14),
    });
    notify(cPaulUser.id, 'TRANSACTION_FAILED', 'Transaction rejetée', `Votre retrait de 650 000 XAF (réf. ${paulTx.reference}) a été rejetée. Motif : client injoignable, profil de retrait inhabituel.`, paulTx.id, iso(4, 14));

    // ---------------------------------------------------------------
    // Clarisse Mefou : litige résolu
    // ---------------------------------------------------------------
    for (let i = 0; i < 8; i++) {
      makeTx({ accountId: acctClarisse.id, type: i % 2 ? 'PAYMENT' : 'WITHDRAWAL', amount: 8000 + i * 6000, daysAgo: 20 - i * 2, hour: 11 + (i % 5) });
    }
    const clarisseTx = makeTx({ accountId: acctClarisse.id, type: 'PAYMENT', amount: 45000, daysAgo: 12, hour: 19, beneficiaryName: 'Restaurant Le Wouri' });
    const dispute2 = disputes.insert({
      id: uuid(),
      reference: 'DP-2026-0987',
      transactionId: clarisseTx.id,
      customerId: cClarisse.id,
      reason: 'Montant incorrect',
      description: 'J’ai été débitée deux fois pour le même repas.',
      status: 'RESOLVED',
      resolution: 'Double débit confirmé par le marchand. Remboursement de 45 000 XAF effectué.',
      createdAt: iso(11, 9),
      updatedAt: iso(8, 15),
      resolvedAt: iso(8, 15),
    });
    disputeNotes.insert({ id: uuid(), disputeId: dispute2.id, authorId: emp1.id, content: 'Contact du marchand effectué — le double débit est confirmé.', createdAt: iso(9, 10) });

    // ---------------------------------------------------------------
    // Autres clients : activité normale + quelques dépôts
    // ---------------------------------------------------------------
    for (let i = 0; i < 12; i++) {
      makeTx({ accountId: acctNadege.id, type: i % 3 === 0 ? 'DEPOSIT' : 'PAYMENT', amount: 15000 + i * 11000, daysAgo: 28 - i * 2, hour: 9 + (i % 7), beneficiaryName: i % 3 === 0 ? undefined : 'Marché Central' });
      makeTx({ accountId: acctRodrigue.id, type: i % 2 ? 'TRANSFER' : 'WITHDRAWAL', amount: 10000 + i * 7000, daysAgo: 26 - i * 2, hour: 10 + (i % 6), targetAccountId: i % 2 ? acctJean.id : undefined });
      makeTx({ accountId: acctEstelle.id, type: i % 3 === 1 ? 'DEPOSIT' : 'PAYMENT', amount: 60000 + i * 23000, daysAgo: 24 - i * 2, hour: 8 + (i % 9), beneficiaryName: i % 3 === 1 ? undefined : 'École Les Génies' });
    }
    for (let i = 0; i < 6; i++) {
      makeTx({ accountId: acctIbrahim.id, type: i % 2 ? 'WITHDRAWAL' : 'PAYMENT', amount: 12000 + i * 8000, daysAgo: 30 - i * 3, hour: 13 });
    }

    // Vérification client en attente chez Estelle (risque moyen)
    const estelleTx = makeTx({
      accountId: acctEstelle.id,
      type: 'PAYMENT',
      amount: 380000,
      daysAgo: 0,
      hour: 7,
      minute: 48,
      status: 'PENDING',
      riskLevel: 'MEDIUM',
      riskScore: 35,
      beneficiaryName: 'Voyages Express',
      requiresVerification: true,
    });
    makeAnalysis(
      estelleTx.id,
      35,
      'MEDIUM',
      'VERIFY',
      [{ code: 'LARGE_AMOUNT_RATIO_PLACEHOLDER', label: 'Montant supérieur à l’habitude', points: 35, detail: '3 × le montant moyen' }].map((x) => ({ ...x, code: 'UNUSUAL_VS_HISTORY', label: 'Montant inhabituel par rapport à l’historique' })),
      'Caractéristiques suspectes. Vérification supplémentaire requise.',
      iso(0, 7, 48),
    );
    notify(cEstelleUser.id, 'VERIFICATION_REQUEST', 'Vérification requise', `Un paiement de 380 000 XAF vers « Voyages Express » a été détecté depuis votre compte. Veuillez confirmer si vous avez initié cette transaction.`, estelleTx.id, iso(0, 7, 48));

    // ---------------------------------------------------------------
    // Journaux d'audit
    // ---------------------------------------------------------------
    audit('LOGIN', { userId: emp1.id, entity: 'USER', entityId: emp1.id, description: 'Connexion de marie.kouassi@finguard.com', createdAt: iso(0, 8) });
    audit('ACCOUNT_FROZEN', { userId: emp2.id, entity: 'ACCOUNT', entityId: acctIbrahim.id, description: `Gel du compte ${acctIbrahim.accountNumber} — suspicion de fraude`, createdAt: iso(2, 15) });
    audit('TRANSACTION_CREATED', { userId: cJeanUser.id, entity: 'TRANSACTION', entityId: bigTx.id, description: `Virement de 2 000 000 XAF initié (réf. ${bigTx.reference})`, createdAt: iso(1, 18, 42) });
    audit('TRANSACTION_HELD', { entity: 'TRANSACTION', entityId: bigTx.id, description: `Transaction mise en attente (score 85) — réf. ${bigTx.reference}`, createdAt: iso(1, 18, 42) });
    audit('TRANSACTION_REJECTED', { userId: emp1.id, entity: 'TRANSACTION', entityId: paulTx.id, description: `Transaction rejetée — réf. ${paulTx.reference}`, createdAt: iso(4, 14) });
    audit('DISPUTE_SUBMITTED', { userId: cJeanUser.id, entity: 'DISPUTE', entityId: dispute1.id, description: `Litige ${dispute1.reference} soumis — motif : transaction non autorisée`, createdAt: iso(4, 10) });
    audit('DISPUTE_RESOLVED', { userId: emp1.id, entity: 'DISPUTE', entityId: dispute2.id, description: `Litige ${dispute2.reference} résolu — remboursement effectué`, createdAt: iso(8, 15) });
    audit('ALERT_ESCALATED', { userId: emp2.id, entity: 'FRAUD_ALERT', entityId: aminaAlert.id, description: 'Alerte escaladée vers l’administration', createdAt: iso(2, 9) });
    audit('CONFIG_UPDATED', { userId: admin.id, entity: 'SYSTEM_CONFIG', description: 'Modification de la configuration : HIGH_RISK_THRESHOLD', createdAt: iso(12, 11) });
    audit('EMPLOYEE_CREATED', { userId: admin.id, entity: 'EMPLOYEE', entityId: emp2.id, description: 'Création de l’employé Emmanuel Njoya', createdAt: iso(90, 9) });

    // Notifications de bienvenue / sécurité diverses
    notify(emp2.id, 'FRAUD_ALERT', 'Transaction suspecte à examiner', `Virement de 2 000 000 XAF — réf. ${bigTx.reference} (score de risque : 85/100).`, bigTx.id, iso(1, 18, 43));
    notify(admin.id, 'SYSTEM', 'Rapport hebdomadaire disponible', 'Le rapport hebdomadaire des transactions est disponible dans l’espace rapports.', undefined, iso(1, 6));
    notify(cJeanUser.id, 'TRANSACTION_SUCCESS', 'Transaction réussie', `Votre dépôt de 850 000 XAF a été traité avec succès.`, undefined, iso(2, 8));
  });

  console.log('✅ Seed terminé.');
  console.log('👤 Comptes de démonstration :');
  console.log('   Admin    : admin@finguard.com / Admin123!');
  console.log('   Employé  : marie.kouassi@finguard.com / Employe123!');
  console.log('   Employé  : emmanuel.njoya@finguard.com / Employe123!');
  console.log('   Client   : client@demo.com / Client123!');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Échec du seed :', e);
  process.exit(1);
});
