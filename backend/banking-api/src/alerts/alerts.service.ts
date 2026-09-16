import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { fraudAlerts, users } from '../database/connection';
import { nowIso } from '../common/utils';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Gestion des alertes de fraude (côté employé / administrateur). */
@Injectable()
export class AlertsService {
  constructor(
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  list(filters: { status?: string }) {
    const { query, rowToCamel } = require('../database/connection');
    const where: string[] = [];
    const params: any[] = [];
    if (filters.status) {
      where.push('fa.status = ?');
      params.push(filters.status);
    }
    const rows = query(
      `SELECT fa.*, t.reference AS tx_reference, t.type AS tx_type, t.amount AS tx_amount,
              t.status AS tx_status, t.risk_score, a.account_number,
              u.first_name, u.last_name
       FROM fraud_alerts fa
       JOIN transactions t ON t.id = fa.transaction_id
       LEFT JOIN accounts a ON a.id = t.source_account_id OR a.id = t.target_account_id
       LEFT JOIN customers c ON c.id = a.customer_id
       LEFT JOIN users u ON u.id = c.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY fa.created_at DESC
       LIMIT 200`,
      params,
    ).map((r: any) => {
      const row = rowToCamel(r);
      return {
        ...row,
        txAmount: Number(row.txAmount),
        escalatedToAdmin: !!row.escalatedToAdmin,
        customerName: row.firstName ? `${row.firstName} ${row.lastName}` : null,
      };
    });
    return rows;
  }

  resolve(userId: string, alertId: string, dto: { resolution: string; notes?: string }, meta?: any) {
    const alert = fraudAlerts.byId(alertId);
    if (!alert) throw new NotFoundException('Alerte introuvable.');
    if (!['APPROVED', 'REJECTED', 'HELD'].includes(dto.resolution)) {
      throw new BadRequestException('Résolution invalide.');
    }
    const updated = fraudAlerts.update(alertId, {
      status: 'RESOLVED',
      resolution: dto.resolution,
      notes: dto.notes
        ? `${alert.notes ? alert.notes + '\n' : ''}${dto.notes}`
        : alert.notes,
      assignedToId: userId,
      resolvedAt: nowIso(),
    });
    this.audit.record({
      userId,
      action: 'FRAUD_ALERT_RESOLVED',
      entity: 'FRAUD_ALERT',
      entityId: alertId,
      description: `Alerte résolue (${dto.resolution})`,
      ...meta,
    });
    return updated;
  }

  escalate(userId: string, alertId: string, notes: string | undefined, meta?: any) {
    const alert = fraudAlerts.byId(alertId);
    if (!alert) throw new NotFoundException('Alerte introuvable.');
    const updated = fraudAlerts.update(alertId, {
      status: 'ESCALATED',
      resolution: 'ESCALATED',
      escalatedToAdmin: true,
      notes: notes ? `${alert.notes ? alert.notes + '\n' : ''}Escalade : ${notes}` : alert.notes,
    });
    this.notify.notifyAdmins(
      'SECURITY_ALERT',
      'Cas de fraude escaladé',
      `Un cas de fraude a été escaladé vers l'administration (transaction liée à l'alerte).`,
      alert.transactionId,
    );
    this.audit.record({
      userId,
      action: 'ALERT_ESCALATED',
      entity: 'FRAUD_ALERT',
      entityId: alertId,
      description: `Alerte escaladée vers l'administration${notes ? ` — ${notes}` : ''}`,
      ...meta,
    });
    return updated;
  }
}
