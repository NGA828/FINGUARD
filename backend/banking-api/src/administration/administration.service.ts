import { BadRequestException, Injectable } from '@nestjs/common';
import { customers, fraudRules, systemConfig, users } from '../database/connection';
import { nowIso } from '../common/utils';
import { CONFIG_DESCRIPTIONS } from '../common/constants';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Administration système : configuration des règles de fraude,
 * limites de transaction, gestion des accès — réservé aux administrateurs.
 */
@Injectable()
export class AdministrationService {
  constructor(
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  listConfig() {
    return systemConfig.all(undefined, [], 'category ASC, `key` ASC');
  }

  updateConfig(values: Record<string, string>, actorId: string, meta?: any) {
    const updated: any[] = [];
    for (const [key, value] of Object.entries(values)) {
      const existing = systemConfig.byId(key);
      if (!existing) throw new BadRequestException(`Paramètre inconnu : ${key}`);
      if (!/^-?\d+(\.\d+)?$/.test(String(value))) {
        throw new BadRequestException(`Valeur numérique attendue pour ${key}.`);
      }
      systemConfig.update(key, { value: String(value), updatedAt: nowIso() });
      updated.push({ key, value: String(value) });
    }
    this.audit.record({
      userId: actorId,
      action: 'CONFIG_UPDATED',
      entity: 'SYSTEM_CONFIG',
      description: `Modification de la configuration : ${Object.keys(values).join(', ')}`,
      ...meta,
    });
    this.notify.notifyAdmins(
      'SYSTEM',
      'Configuration modifiée',
      `La configuration du système a été mise à jour : ${Object.keys(values).join(', ')}.`,
    );
    return this.listConfig();
  }

  listRules() {
    return fraudRules.all(undefined, [], 'points DESC');
  }

  updateRule(ruleId: string, dto: { isActive?: boolean; points?: number; threshold?: number | null }, actorId: string, meta?: any) {
    const rule = fraudRules.byId(ruleId);
    if (!rule) throw new BadRequestException('Règle introuvable.');
    const patch: any = { updatedAt: nowIso() };
    if (dto.isActive !== undefined) patch.isActive = !!dto.isActive;
    if (dto.points !== undefined) {
      if (dto.points < 0 || dto.points > 100) throw new BadRequestException('Points entre 0 et 100.');
      patch.points = Math.round(dto.points);
    }
    if (dto.threshold !== undefined) patch.threshold = dto.threshold;
    fraudRules.update(ruleId, patch);
    this.audit.record({
      userId: actorId,
      action: 'RULE_UPDATED',
      entity: 'FRAUD_RULE',
      entityId: ruleId,
      description: `Règle de fraude « ${rule.name} » mise à jour`,
      ...meta,
    });
    return fraudRules.byId(ruleId);
  }

  /** Active/désactive un client (accès au système). */
  toggleCustomerActive(customerId: string, actorId: string, meta?: any) {
    const customer = customers.byId(customerId);
    if (!customer) throw new BadRequestException('Client introuvable.');
    const user = users.byId(customer.userId);
    const newState = !user.isActive;
    users.update(user.id, { isActive: newState, updatedAt: nowIso() });
    customers.update(customerId, { isActive: newState });
    this.audit.record({
      userId: actorId,
      action: newState ? 'CUSTOMER_ACTIVATED' : 'CUSTOMER_DEACTIVATED',
      entity: 'CUSTOMER',
      entityId: customerId,
      description: `${newState ? 'Activation' : 'Désactivation'} du client ${user.firstName} ${user.lastName}`,
      ...meta,
    });
    return { id: customerId, isActive: newState };
  }
}
