import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  accounts,
  customers,
  disputeNotes,
  disputes,
  fraudAlerts,
  notifications,
  query,
  rowToCamel,
  systemConfig,
  transactions,
  tx,
  users,
} from '../database/connection';
import { disputeReference, formatXAF, nowIso, txReference, uuid } from '../common/utils';
import { AuditService } from '../audit/audit.service';
import { FraudService } from '../fraud/fraud.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExternalBankService } from './external-bank.service';

export const TX_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'dépôt',
  WITHDRAWAL: 'retrait',
  TRANSFER: 'virement',
  PAYMENT: 'paiement',
};

export interface InitiateTxInput {
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'PAYMENT';
  amount: number;
  accountId?: string;
  targetAccountNumber?: string;
  beneficiaryName?: string;
  description?: string;
}

/**
 * Service central des transactions : validation → analyse de fraude →
 * décision (autoriser / vérifier / mettre en attente) → traitement →
 * notifications → audit (cahier des charges §32).
 */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly audit: AuditService,
    private readonly fraud: FraudService,
    private readonly notify: NotificationsService,
    private readonly external: ExternalBankService,
  ) {}

  // ------------------------------------------------------------------
  // Étape 1-5 : initiation, validation, analyse, décision
  // ------------------------------------------------------------------

  async initiate(input: InitiateTxInput, user: any, meta: { ip?: string; userAgent?: string }) {
    const amount = Math.round(Number(input.amount));
    if (!amount || amount <= 0) throw new BadRequestException('Le montant doit être supérieur à 0.');
    if (!['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT'].includes(input.type)) {
      throw new BadRequestException('Type de transaction invalide.');
    }

    // --- Résolution du compte source ---
    let account = input.accountId ? accounts.byId(input.accountId) : null;
    if (!account) {
      const customer = customers.first('user_id = ?', [user.sub]);
      if (customer) account = accounts.first('customer_id = ?', [customer.id]);
    } else {
      const customer = customers.byId(account.customerId);
      if (customer.userId !== user.sub && user.role === 'CLIENT') {
        throw new BadRequestException("Ce compte ne vous appartient pas.");
      }
    }
    if (!account) throw new BadRequestException('Aucun compte disponible pour cette opération.');
    if (account.status !== 'ACTIVE') {
      throw new BadRequestException(
        account.status === 'FROZEN'
          ? 'Votre compte est gelé. Veuillez contacter votre banque.'
          : "Ce compte n'est plus actif.",
      );
    }

    // --- Limites (compte + configuration globale) ---
    const cfg = this.globalConfig();
    const perTxLimit = Math.min(Number(account.perTxLimit), cfg.globalPerTxLimit);
    if (amount > perTxLimit) {
      throw new BadRequestException(
        `Le montant dépasse votre limite par transaction (${formatXAF(perTxLimit)}).`,
      );
    }

    const isOutgoing = input.type !== 'DEPOSIT';

    // --- Compte bénéficiaire (virement) ---
    let targetAccount: any = null;
    if (input.type === 'TRANSFER') {
      if (!input.targetAccountNumber) {
        throw new BadRequestException('Le numéro du compte bénéficiaire est requis.');
      }
      targetAccount = accounts.first('account_number = ?', [input.targetAccountNumber.trim()]);
      if (!targetAccount) throw new BadRequestException('Compte bénéficiaire introuvable.');
      if (targetAccount.id === account.id) {
        throw new BadRequestException('Impossible de faire un virement vers le même compte.');
      }
      if (targetAccount.status !== 'ACTIVE') {
        throw new BadRequestException('Le compte bénéficiaire est inactif ou gelé.');
      }
    }
    if (input.type === 'PAYMENT' && !input.beneficiaryName) {
      throw new BadRequestException('Le nom du bénéficiaire/commerçant est requis.');
    }

    // --- Solde et limite quotidienne ---
    if (isOutgoing) {
      if (amount > Number(account.balance)) {
        throw new BadRequestException(
          `Solde insuffisant. Solde disponible : ${formatXAF(Number(account.balance))}.`,
        );
      }
      const spentToday = transactions.sum(
        'amount',
        `source_account_id = ? AND date(created_at) = date('now') AND status IN ('COMPLETED','PENDING','PROCESSING','UNDER_REVIEW')`,
        [account.id],
      );
      const dailyLimit = Math.min(Number(account.dailyLimit), cfg.globalDailyLimit);
      if (spentToday + amount > dailyLimit) {
        throw new BadRequestException(
          `Limite quotidienne dépassée. Restant disponible aujourd'hui : ${formatXAF(
            Math.max(0, dailyLimit - spentToday),
          )}.`,
        );
      }
    }

    // --- Création de la transaction ---
    const now = nowIso();
    const transaction = transactions.insert({
      id: uuid(),
      reference: txReference(),
      type: input.type,
      status: 'PROCESSING',
      amount,
      sourceAccountId: input.type === 'DEPOSIT' ? null : account.id,
      targetAccountId:
        input.type === 'TRANSFER' ? targetAccount.id : input.type === 'DEPOSIT' ? account.id : null,
      beneficiaryName: input.beneficiaryName ?? null,
      description: input.description ?? null,
      requiresVerification: false,
      createdByUserId: user.sub,
      createdAt: now,
      updatedAt: now,
    });

    this.audit.record({
      userId: user.sub,
      action: 'TRANSACTION_CREATED',
      entity: 'TRANSACTION',
      entityId: transaction.id,
      description: `${TX_TYPE_LABELS[input.type]} de ${formatXAF(amount)} initié (réf. ${transaction.reference})`,
      ...meta,
    });

    // --- Étape 3 & 4 : analyse de fraude et évaluation du risque ---
    const result = this.fraud.analyze(
      { ...transaction, targetAccountId: targetAccount?.id ?? null },
      account,
    );
    this.fraud.persist(transaction.id, result);
    transactions.update(transaction.id, {
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      updatedAt: nowIso(),
    });

    // --- Étape 5 : décision ---
    const final = await this.decide(transaction.id, account, result, user, meta);
    return this.enrich(final);
  }

  private async decide(
    txId: string,
    account: any,
    result: { riskScore: number; riskLevel: string; action: string; summary: string },
    user: any,
    meta: any,
  ) {
    const transaction = transactions.byId(txId);
    const typeLabel = TX_TYPE_LABELS[transaction.type];
    const customerUser = this.customerUserOfAccount(account);

    if (result.action === 'AUTHORIZE') {
      return this.complete(txId, user.sub, meta);
    }

    if (result.action === 'VERIFY') {
      transactions.update(txId, { status: 'PENDING', requiresVerification: true, updatedAt: nowIso() });
      this.notify.notify(
        customerUser.id,
        'VERIFICATION_REQUEST',
        'Vérification requise',
        `Un ${typeLabel} de ${formatXAF(Number(transaction.amount))} a été détecté depuis votre compte ${account.accountNumber}. Veuillez confirmer si vous avez initié cette transaction.`,
        txId,
      );
      this.audit.record({
        userId: user.sub,
        action: 'VERIFICATION_REQUESTED',
        entity: 'TRANSACTION',
        entityId: txId,
        description: `Vérification client demandée (score ${result.riskScore}) — réf. ${transaction.reference}`,
      });
      return transactions.byId(txId);
    }

    // HOLD : haut risque → mise en attente + alerte de fraude.
    transactions.update(txId, { status: 'UNDER_REVIEW', updatedAt: nowIso() });
    fraudAlerts.insert({
      id: uuid(),
      transactionId: txId,
      accountId: account.id,
      level: 'HIGH',
      status: 'OPEN',
      createdAt: nowIso(),
    });
    this.notify.notify(
      customerUser.id,
      'FRAUD_ALERT',
      'Alerte de sécurité',
      `Votre ${typeLabel} de ${formatXAF(Number(transaction.amount))} (réf. ${transaction.reference}) présente un risque élevé et a été mis en attente pour examen.`,
      txId,
    );
    if (this.globalConfig().notifyEmployeesOnHigh) {
      this.notify.notifyEmployees(
        'FRAUD_ALERT',
        'Transaction suspecte à examiner',
        `${TX_TYPE_LABELS[transaction.type]} de ${formatXAF(Number(transaction.amount))} — réf. ${transaction.reference} (score de risque : ${result.riskScore}/100).`,
        txId,
      );
    }
    this.audit.record({
      action: 'TRANSACTION_HELD',
      entity: 'TRANSACTION',
      entityId: txId,
      description: `Transaction mise en attente (score ${result.riskScore}) — réf. ${transaction.reference}`,
    });
    return transactions.byId(txId);
  }

  // ------------------------------------------------------------------
  // Traitement final : application des mouvements de solde
  // ------------------------------------------------------------------

  async complete(txId: string, actorUserId: string | null, meta?: any) {
    const transaction = transactions.byId(txId);
    if (!transaction) throw new NotFoundException('Transaction introuvable.');
    if (!['PENDING', 'PROCESSING', 'UNDER_REVIEW'].includes(transaction.status)) {
      throw new BadRequestException('Cette transaction est déjà finalisée.');
    }

    return tx(() => {
      // Service bancaire externe (simulé).
      // Pour un dépôt réel, la banque externe crédite le compte.
      const source = transaction.sourceAccountId ? accounts.byId(transaction.sourceAccountId) : null;
      const target = transaction.targetAccountId ? accounts.byId(transaction.targetAccountId) : null;

      if (source) {
        if (transaction.type !== 'DEPOSIT' && Number(source.balance) < Number(transaction.amount)) {
          const failed = transactions.update(txId, {
            status: 'FAILED',
            statusReason: 'Solde insuffisant au moment du traitement.',
            updatedAt: nowIso(),
          });
          this.notifyCustomerFailed(failed, 'Solde insuffisant au moment du traitement.');
          return failed;
        }
        accounts.update(source.id, { balance: Number(source.balance) - Number(transaction.amount) });
      }
      const creditAccount = transaction.type === 'DEPOSIT' ? target : source && target ? target : null;
      if (transaction.type === 'DEPOSIT' && target) {
        accounts.update(target.id, { balance: Number(target.balance) + Number(transaction.amount) });
      } else if (transaction.type === 'TRANSFER' && target) {
        accounts.update(target.id, { balance: Number(target.balance) + Number(transaction.amount) });
      }
      void creditAccount;

      const completed = transactions.update(txId, {
        status: 'COMPLETED',
        requiresVerification: false,
        externalReference: `EXT-${uuid().slice(0, 8).toUpperCase()}`,
        reviewedByUserId: actorUserId,
        completedAt: nowIso(),
        updatedAt: nowIso(),
      });

      // Notifications + audit.
      const customerUser = source
        ? this.customerUserOfAccount(source)
        : target
          ? this.customerUserOfAccount(target)
          : null;
      if (customerUser) {
        this.notify.notify(
          customerUser.id,
          'TRANSACTION_SUCCESS',
          'Transaction réussie',
          `Votre ${TX_TYPE_LABELS[completed.type]} de ${formatXAF(Number(completed.amount))} a été traité avec succès (réf. ${completed.reference}).`,
          txId,
        );
      }
      this.audit.record({
        userId: actorUserId,
        action: 'TRANSACTION_COMPLETED',
        entity: 'TRANSACTION',
        entityId: txId,
        description: `Transaction terminée — réf. ${completed.reference}`,
        ...meta,
      });
      return completed;
    });
  }

  reject(txId: string, reason: string, actorUserId: string | null, meta?: any) {
    const transaction = transactions.byId(txId);
    if (!transaction) throw new NotFoundException('Transaction introuvable.');
    if (!['PENDING', 'PROCESSING', 'UNDER_REVIEW'].includes(transaction.status)) {
      throw new BadRequestException('Cette transaction est déjà finalisée.');
    }
    const rejected = transactions.update(txId, {
      status: 'REJECTED',
      statusReason: reason || 'Rejetée après examen.',
      requiresVerification: false,
      reviewedByUserId: actorUserId,
      updatedAt: nowIso(),
    });
    this.resolveOpenAlerts(txId, 'REJECTED', reason);
    const customerUser = this.customerUserOfTransaction(rejected);
    if (customerUser) {
      this.notify.notify(
        customerUser.id,
        'TRANSACTION_FAILED',
        'Transaction rejetée',
        `Votre ${TX_TYPE_LABELS[rejected.type]} de ${formatXAF(Number(rejected.amount))} (réf. ${rejected.reference}) a été rejetée. Motif : ${reason || 'non précisé'}.`,
        txId,
      );
    }
    this.audit.record({
      userId: actorUserId,
      action: 'TRANSACTION_REJECTED',
      entity: 'TRANSACTION',
      entityId: txId,
      description: `Transaction rejetée — réf. ${rejected.reference}. Motif : ${reason || 'non précisé'}`,
      ...meta,
    });
    return rejected;
  }

  // ------------------------------------------------------------------
  // Vérification par le client (risque moyen)
  // ------------------------------------------------------------------

  async customerConfirm(userId: string, txId: string, legitimate: boolean, meta?: any) {
    const transaction = transactions.byId(txId);
    if (!transaction) throw new NotFoundException('Transaction introuvable.');
    if (transaction.status !== 'PENDING' || !transaction.requiresVerification) {
      throw new BadRequestException('Cette transaction ne nécessite pas de vérification.');
    }
    const account = accounts.byId(
      transaction.sourceAccountId || transaction.targetAccountId,
    );
    const customer = customers.byId(account.customerId);
    if (customer.userId !== userId) throw new BadRequestException('Transaction non autorisée.');

    if (legitimate) {
      this.audit.record({
        userId,
        action: 'VERIFICATION_CONFIRMED',
        entity: 'TRANSACTION',
        entityId: txId,
        description: `Client a confirmé la transaction réf. ${transaction.reference}`,
        ...meta,
      });
      const completed = await this.complete(txId, userId, meta);
      return this.enrich(completed);
    }

    // Le client signale une transaction non autorisée → rejet + litige automatique.
    const rejected = transactions.update(txId, {
      status: 'REJECTED',
      statusReason: 'Transaction non reconnue par le client.',
      requiresVerification: false,
      updatedAt: nowIso(),
    });
    const dispute = disputes.insert({
      id: uuid(),
      reference: disputeReference(),
      transactionId: txId,
      customerId: customer.id,
      reason: 'Transaction non autorisée',
      description: 'Le client a indiqué ne pas avoir initié cette transaction.',
      status: 'SUBMITTED',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.notify.notifyEmployees(
      'DISPUTE_UPDATE',
      'Nouveau litige soumis',
      `Le client a signalé la transaction ${transaction.reference} comme non autorisée (litige ${dispute.reference}).`,
      txId,
    );
    this.audit.record({
      userId,
      action: 'DISPUTE_SUBMITTED',
      entity: 'DISPUTE',
      entityId: dispute.id,
      description: `Litige automatique suite au rejet de la transaction réf. ${transaction.reference}`,
      ...meta,
    });
    return { ...this.enrich(rejected), autoDispute: dispute };
  }

  // ------------------------------------------------------------------
  // Révision par les employés (risque élevé)
  // ------------------------------------------------------------------

  async employeeApprove(userId: string, txId: string, notes: string | undefined, meta?: any) {
    this.assertReviewable(txId);
    if (notes) this.appendAlertNotes(txId, userId, `Approbation : ${notes}`);
    const completed = await this.complete(txId, userId, meta);
    this.resolveOpenAlerts(txId, 'APPROVED', notes);
    return this.enrich(completed);
  }

  employeeReject(userId: string, txId: string, reason: string | undefined, meta?: any) {
    this.assertReviewable(txId);
    const rejected = this.reject(txId, reason || 'Rejetée après examen manuel.', userId, meta);
    return this.enrich(rejected);
  }

  employeeHold(userId: string, txId: string, notes: string | undefined, meta?: any) {
    const transaction = transactions.byId(txId);
    if (!transaction) throw new NotFoundException('Transaction introuvable.');
    transactions.update(txId, { status: 'UNDER_REVIEW', updatedAt: nowIso() });
    this.appendAlertNotes(txId, userId, notes || 'Maintenue en attente de révision.');
    this.audit.record({
      userId,
      action: 'TRANSACTION_HELD',
      entity: 'TRANSACTION',
      entityId: txId,
      description: `Transaction maintenue en attente — réf. ${transaction.reference}`,
      ...meta,
    });
    return this.enrich(transactions.byId(txId));
  }

  private assertReviewable(txId: string) {
    const transaction = transactions.byId(txId);
    if (!transaction) throw new NotFoundException('Transaction introuvable.');
    if (!['PENDING', 'PROCESSING', 'UNDER_REVIEW'].includes(transaction.status)) {
      throw new BadRequestException('Cette transaction est déjà finalisée.');
    }
    return transaction;
  }

  private appendAlertNotes(txId: string, userId: string, note: string) {
    const alert = fraudAlerts.first('transaction_id = ?', [txId]);
    if (alert) {
      const user = users.byId(userId);
      const author = user ? `${user.firstName} ${user.lastName}` : 'Système';
      fraudAlerts.update(alert.id, {
        notes: `${alert.notes ? alert.notes + '\n' : ''}[${author}] ${note}`,
      });
    }
  }

  private resolveOpenAlerts(txId: string, resolution: string, notes?: string) {
    const open = fraudAlerts.all("transaction_id = ? AND status IN ('OPEN','UNDER_REVIEW')", [txId]);
    for (const a of open) {
      fraudAlerts.update(a.id, {
        status: 'RESOLVED',
        resolution,
        notes: notes ? `${a.notes ? a.notes + '\n' : ''}Résolution : ${notes}` : a.notes,
        resolvedAt: nowIso(),
      });
    }
  }

  // ------------------------------------------------------------------
  // Requêtes / listes
  // ------------------------------------------------------------------

  listForCustomer(userId: string, filters: any) {
    const customer = customers.first('user_id = ?', [userId]);
    if (!customer) return { items: [], total: 0 };
    const accountIds = accounts.all('customer_id = ?', [customer.id]).map((a) => a.id);
    if (accountIds.length === 0) return { items: [], total: 0 };
    const placeholders = accountIds.map(() => '?').join(',');
    return this.listTx(
      `(source_account_id IN (${placeholders}) OR target_account_id IN (${placeholders}))`,
      [...accountIds, ...accountIds],
      filters,
    );
  }

  listAll(filters: any) {
    return this.listTx(undefined, [], filters);
  }

  suspicious(userId?: string) {
    const rows = query(
      `SELECT t.*, fa.id AS alert_id, fa.status AS alert_status, fa.level AS alert_level,
              a.account_number, u.first_name, u.last_name
       FROM transactions t
       JOIN fraud_alerts fa ON fa.transaction_id = t.id
       LEFT JOIN accounts a ON a.id = t.source_account_id OR a.id = t.target_account_id
       LEFT JOIN customers c ON c.id = a.customer_id
       LEFT JOIN users u ON u.id = c.user_id
       ORDER BY fa.created_at DESC
       LIMIT 100`,
    ).map(this.shapeTx);
    return rows;
  }

  private listTx(baseWhere: string | undefined, baseParams: any[], filters: any) {
    const where: string[] = baseWhere ? [baseWhere] : [];
    const params: any[] = [...baseParams];
    if (filters.type) {
      where.push('type = ?');
      params.push(filters.type);
    }
    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }
    if (filters.from) {
      where.push('date(created_at) >= date(?)');
      params.push(filters.from);
    }
    if (filters.to) {
      where.push('date(created_at) <= date(?)');
      params.push(filters.to);
    }
    if (filters.q) {
      where.push('(reference LIKE ? OR beneficiary_name LIKE ? OR description LIKE ?)');
      params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }
    const limit = Math.min(Number(filters.limit) || 50, 200);
    const sql = `SELECT * FROM transactions ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY created_at DESC LIMIT ${limit}`;
    const items = query(sql, params).map(this.shapeTx);
    return { items, total: items.length };
  }

  getDetail(txId: string) {
    const transaction = transactions.byId(txId);
    if (!transaction) throw new NotFoundException('Transaction introuvable.');
    const analysis = this.fraud.forTransaction(txId);
    const alerts = fraudAlerts.all('transaction_id = ?', [txId], 'created_at DESC');
    const disputeList = disputes.all('transaction_id = ?', [txId], 'created_at DESC');
    const source = transaction.sourceAccountId ? this.accountWithOwner(transaction.sourceAccountId) : null;
    const target = transaction.targetAccountId ? this.accountWithOwner(transaction.targetAccountId) : null;

    // Activité antérieure connexe du compte source (contexte d'examen).
    let related: any[] = [];
    if (transaction.sourceAccountId) {
      related = query(
        `SELECT * FROM transactions
         WHERE source_account_id = ? AND id != ?
         ORDER BY created_at DESC LIMIT 6`,
        [transaction.sourceAccountId, txId],
      ).map((t: any) => ({ ...t, amount: Number(t.amount) }));
    }

    return {
      ...this.shapeTx(transaction as any),
      analysis,
      alerts,
      disputes: disputeList,
      sourceAccount: source,
      targetAccount: target,
      relatedTransactions: related,
    };
  }

  private accountWithOwner(accountId: string) {
    const a = accounts.byId(accountId);
    if (!a) return null;
    const c = customers.byId(a.customerId);
    const u = c ? users.byId(c.userId) : null;
    return {
      id: a.id,
      accountNumber: a.accountNumber,
      status: a.status,
      owner: u ? `${u.firstName} ${u.lastName}` : null,
    };
  }

  private shapeTx(t: any) {
    return { ...t, amount: Number(t.amount), riskScore: t.riskScore ?? null };
  }

  /**
   * Relevé de compte : toutes les transactions touchant le compte,
   * avec sens (débit/crédit) pour l'export CSV (cahier des charges §16).
   */
  statement(accountId: string) {
    const account = accounts.byId(accountId);
    if (!account) throw new NotFoundException('Compte introuvable.');
    const rows = query(
      `SELECT * FROM transactions
       WHERE (source_account_id = ? OR target_account_id = ?)
       ORDER BY created_at DESC`,
      [accountId, accountId],
    ).map((raw: any) => {
      const t = this.shapeTx(rowToCamel(raw));
      const isDebit = raw.source_account_id === accountId;
      return {
        ...t,
        direction: isDebit ? 'DEBIT' : 'CREDIT',
      };
    });
    return { account: { id: account.id, accountNumber: account.accountNumber, balance: Number(account.balance) }, rows };
  }

  /**
   * Export administrateur : toutes les transactions du système avec les
   * numéros de compte source/cible, pour les rapports CSV (§16, §22).
   */
  exportAll(filters: { status?: string; type?: string; from?: string; to?: string } = {}) {
    const where: string[] = [];
    const params: any[] = [];
    if (filters.status) {
      where.push('t.status = ?');
      params.push(filters.status);
    }
    if (filters.type) {
      where.push('t.type = ?');
      params.push(filters.type);
    }
    if (filters.from) {
      where.push('t.created_at >= ?');
      params.push(`${filters.from}T00:00:00`);
    }
    if (filters.to) {
      where.push('t.created_at <= ?');
      params.push(`${filters.to}T23:59:59`);
    }
    const rows = query(
      `SELECT t.*, sa.account_number AS source_number, ta.account_number AS target_number
       FROM transactions t
       LEFT JOIN accounts sa ON sa.id = t.source_account_id
       LEFT JOIN accounts ta ON ta.id = t.target_account_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY t.created_at DESC`,
      params,
    ).map((raw: any) => {
      const t = this.shapeTx(rowToCamel(raw));
      return { ...t, sourceNumber: raw.source_number ?? '—', targetNumber: raw.target_number ?? '—' };
    });
    return rows;
  }

  private enrich(t: any) {
    if (!t) return t;
    const analysis = this.fraud.forTransaction(t.id);
    return { ...this.shapeTx(t), analysis };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private globalConfig() {
    const rows = systemConfig.all();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return {
      globalPerTxLimit: Number(map.GLOBAL_PER_TX_LIMIT ?? 5000000),
      globalDailyLimit: Number(map.GLOBAL_DAILY_LIMIT ?? 10000000),
      notifyEmployeesOnHigh: (map.NOTIFY_EMPLOYEES_ON_HIGH ?? '1') === '1',
    };
  }

  customerUserOfAccount(account: any) {
    const customer = customers.byId(account.customerId);
    return customer ? users.byId(customer.userId) : null;
  }

  customerUserOfTransaction(transaction: any) {
    const accountId = transaction.sourceAccountId || transaction.targetAccountId;
    if (!accountId) return null;
    const account = accounts.byId(accountId);
    return account ? this.customerUserOfAccount(account) : null;
  }

  private notifyCustomerFailed(transaction: any, reason: string) {
    const customerUser = this.customerUserOfTransaction(transaction);
    if (customerUser) {
      this.notify.notify(
        customerUser.id,
        'TRANSACTION_FAILED',
        'Transaction échouée',
        `Votre ${TX_TYPE_LABELS[transaction.type]} de ${formatXAF(Number(transaction.amount))} (réf. ${transaction.reference}) a échoué. Motif : ${reason}`,
        transaction.id,
      );
    }
  }
}
