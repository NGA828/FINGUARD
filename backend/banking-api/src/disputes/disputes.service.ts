import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { customers, disputeNotes, disputes, transactions, users } from '../database/connection';
import { disputeReference, formatXAF, nowIso, uuid } from '../common/utils';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Gestion des litiges : signalement par le client, investigation par l'employé. */
@Injectable()
export class DisputesService {
  constructor(
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  submit(userId: string, dto: { transactionId: string; reason: string; description?: string }, meta?: any) {
    const transaction = transactions.byId(dto.transactionId);
    if (!transaction) throw new NotFoundException('Transaction introuvable.');
    const customer = customers.first('user_id = ?', [userId]);
    if (!customer) throw new NotFoundException('Profil client introuvable.');

    // La transaction doit appartenir au client.
    const { accounts } = require('../database/connection');
    const accountId = transaction.sourceAccountId || transaction.targetAccountId;
    const account = accountId ? accounts.byId(accountId) : null;
    if (!account || account.customerId !== customer.id) {
      throw new BadRequestException('Cette transaction ne vous appartient pas.');
    }
    const existing = disputes.first('transaction_id = ?', [transaction.id]);
    if (existing) throw new BadRequestException('Un litige existe déjà pour cette transaction.');

    const dispute = disputes.insert({
      id: uuid(),
      reference: disputeReference(),
      transactionId: transaction.id,
      customerId: customer.id,
      reason: dto.reason,
      description: dto.description ?? null,
      status: 'SUBMITTED',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    this.notify.notifyEmployees(
      'DISPUTE_UPDATE',
      'Nouveau litige soumis',
      `Litige ${dispute.reference} : ${dto.reason} (transaction ${transaction.reference}, ${formatXAF(Number(transaction.amount))}).`,
      transaction.id,
    );
    this.audit.record({
      userId,
      action: 'DISPUTE_SUBMITTED',
      entity: 'DISPUTE',
      entityId: dispute.id,
      description: `Litige ${dispute.reference} soumis — motif : ${dto.reason}`,
      ...meta,
    });
    return this.getDetail(dispute.id);
  }

  listForCustomer(userId: string) {
    const customer = customers.first('user_id = ?', [userId]);
    if (!customer) return [];
    const rows = disputes.all('customer_id = ?', [customer.id], 'created_at DESC');
    return rows.map((d) => this.withTransaction(d));
  }

  listAll(filters: { status?: string }) {
    const where: string[] = [];
    const params: any[] = [];
    if (filters.status) {
      where.push('d.status = ?');
      params.push(filters.status);
    }
    const { query, rowToCamel } = require('../database/connection');
    const rows = query(
      `SELECT d.*, t.reference AS tx_reference, t.type AS tx_type, t.amount AS tx_amount,
              u.first_name, u.last_name, u.email
       FROM disputes d
       JOIN transactions t ON t.id = d.transaction_id
       JOIN customers c ON c.id = d.customer_id
       JOIN users u ON u.id = c.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY d.created_at DESC
       LIMIT 200`,
      params,
    ).map((r: any) => {
      const row = rowToCamel(r);
      return {
        ...row,
        txAmount: Number(row.txAmount),
        customerName: `${row.firstName} ${row.lastName}`,
      };
    });
    return rows;
  }

  getDetail(disputeId: string) {
    const dispute = disputes.byId(disputeId);
    if (!dispute) throw new NotFoundException('Litige introuvable.');
    const notes = disputeNotes.all('dispute_id = ?', [disputeId], 'created_at ASC');
    const withAuthors = notes.map((n) => {
      const author = n.authorId ? users.byId(n.authorId) : null;
      return { ...n, author: author ? `${author.firstName} ${author.lastName}` : 'Système' };
    });
    return { ...this.withTransaction(dispute), notes: withAuthors };
  }

  updateStatus(userId: string, disputeId: string, status: string, meta?: any) {
    const valid = ['SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATING', 'RESOLVED', 'REJECTED', 'CLOSED'];
    if (!valid.includes(status)) throw new BadRequestException('Statut de litige invalide.');
    const dispute = disputes.byId(disputeId);
    if (!dispute) throw new NotFoundException('Litige introuvable.');
    const updated = disputes.update(disputeId, { status, updatedAt: nowIso() });
    const customer = customers.byId(dispute.customerId);
    if (customer) {
      this.notify.notify(
        customer.userId,
        'DISPUTE_UPDATE',
        'Mise à jour de votre litige',
        `Votre litige ${dispute.reference} est maintenant « ${statusLabel(status)} ».`,
        dispute.transactionId,
      );
    }
    this.audit.record({
      userId,
      action: 'DISPUTE_STATUS_UPDATED',
      entity: 'DISPUTE',
      entityId: disputeId,
      description: `Statut du litige ${dispute.reference} → ${status}`,
      ...meta,
    });
    return this.getDetail(disputeId);
  }

  addNote(userId: string, disputeId: string, content: string) {
    const dispute = disputes.byId(disputeId);
    if (!dispute) throw new NotFoundException('Litige introuvable.');
    disputeNotes.insert({
      id: uuid(),
      disputeId,
      authorId: userId,
      content,
      createdAt: nowIso(),
    });
    if (dispute.status === 'SUBMITTED') {
      disputes.update(disputeId, { status: 'UNDER_REVIEW', updatedAt: nowIso() });
    }
    return this.getDetail(disputeId);
  }

  resolve(userId: string, disputeId: string, dto: { resolution: string; reject?: boolean }, meta?: any) {
    const dispute = disputes.byId(disputeId);
    if (!dispute) throw new NotFoundException('Litige introuvable.');
    const status = dto.reject ? 'REJECTED' : 'RESOLVED';
    const updated = disputes.update(disputeId, {
      status,
      resolution: dto.resolution,
      resolvedAt: nowIso(),
      updatedAt: nowIso(),
    });
    const customer = customers.byId(dispute.customerId);
    if (customer) {
      this.notify.notify(
        customer.userId,
        'DISPUTE_UPDATE',
        status === 'RESOLVED' ? 'Litige résolu' : 'Litige rejeté',
        `Votre litige ${dispute.reference} a été ${status === 'RESOLVED' ? 'résolu' : 'rejeté'} : ${dto.resolution}`,
        dispute.transactionId,
      );
    }
    this.audit.record({
      userId,
      action: 'DISPUTE_RESOLVED',
      entity: 'DISPUTE',
      entityId: disputeId,
      description: `Litige ${dispute.reference} ${status === 'RESOLVED' ? 'résolu' : 'rejeté'}`,
      ...meta,
    });
    return this.getDetail(disputeId);
  }

  private withTransaction(dispute: any) {
    const t = transactions.byId(dispute.transactionId);
    return {
      ...dispute,
      transaction: t ? { ...t, amount: Number(t.amount) } : null,
    };
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    SUBMITTED: 'Soumis',
    UNDER_REVIEW: 'En cours d’examen',
    INVESTIGATING: 'En cours d’investigation',
    RESOLVED: 'Résolu',
    REJECTED: 'Rejeté',
    CLOSED: 'Clos',
  };
  return map[status] || status;
}
