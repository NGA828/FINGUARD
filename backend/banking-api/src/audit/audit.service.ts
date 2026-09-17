import { BadRequestException, Injectable } from '@nestjs/common';
import { auditLogs } from '../database/connection';
import { nowIso, uuid } from '../common/utils';

export interface AuditInput {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  description?: string;
  ip?: string;
  userAgent?: string;
}

/** Journal d'audit : trace toutes les activités importantes du système. */
@Injectable()
export class AuditService {
  record(input: AuditInput): void {
    auditLogs.insert({
      id: uuid(),
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      description: input.description ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: nowIso(),
    });
  }

  list(filters: { q?: string; entity?: string; action?: string; limit?: number }) {
    const where: string[] = [];
    const params: any[] = [];
    if (filters.entity) {
      where.push('entity = ?');
      params.push(filters.entity);
    }
    if (filters.action) {
      where.push('action = ?');
      params.push(filters.action);
    }
    if (filters.q) {
      where.push(
        '(description LIKE ? OR entity_id LIKE ? OR id IN (SELECT id FROM audit_logs WHERE description LIKE ?))',
      );
      params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }
    const rows = auditLogs.all(
      where.length ? where.join(' AND ') : undefined,
      params,
      'created_at DESC',
      Math.min(Number(filters.limit) || 100, 500),
    );
    const users = this.attachUsers(rows);
    return users;
  }

  private attachUsers(rows: any[]) {
    const { users } = require('../database/connection');
    return rows.map((r) => {
      if (!r.userId) return { ...r, user: null };
      const u = users.byId(r.userId);
      return {
        ...r,
        user: u ? { id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, role: u.role } : null,
      };
    });
  }

  assertValidAction(action: string) {
    if (!action) throw new BadRequestException('Action requise.');
  }
}
