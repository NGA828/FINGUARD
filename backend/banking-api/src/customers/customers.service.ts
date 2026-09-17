import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { accounts, customers, transactions, users } from '../database/connection';
import { nowIso, uuid } from '../common/utils';
import { AuditService } from '../audit/audit.service';
import { AccountsService } from '../accounts/accounts.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateCustomerDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  city?: string;
  initialDeposit?: number;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly audit: AuditService,
    private readonly accountsService: AccountsService,
    private readonly notify: NotificationsService,
  ) {}

  search(q?: string) {
    const { query, rowToCamel } = require('../database/connection');
    const where: string[] = [];
    const params: any[] = [];
    if (q) {
      where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    return query(
      `SELECT c.*, u.first_name, u.last_name, u.email, u.phone, u.is_active AS user_active,
              (SELECT COUNT(*) FROM accounts a WHERE a.customer_id = c.id) AS accounts_count
       FROM customers c
       JOIN users u ON u.id = c.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY c.created_at DESC
       LIMIT 200`,
      params,
    ).map((r: any) => {
      const row = rowToCamel(r);
      return {
        ...row,
        name: `${row.firstName} ${row.lastName}`,
        isActive: !!row.isActive && !!row.userActive,
        accountsCount: Number(row.accountsCount),
      };
    });
  }

  getDetail(customerId: string) {
    const customer = customers.byId(customerId);
    if (!customer) throw new NotFoundException('Client introuvable.');
    const user = users.byId(customer.userId);
    const accountsList = accounts.all('customer_id = ?', [customerId], 'opened_at ASC');
    const accountIds = accountsList.map((a) => a.id);
    let recent: any[] = [];
    if (accountIds.length) {
      const { query } = require('../database/connection');
      const ph = accountIds.map(() => '?').join(',');
      recent = query(
        `SELECT * FROM transactions
         WHERE source_account_id IN (${ph}) OR target_account_id IN (${ph})
         ORDER BY created_at DESC LIMIT 15`,
        [...accountIds, ...accountIds],
      ).map((t: any) => ({ ...t, amount: Number(t.amount) }));
    }
    return {
      ...customer,
      isActive: !!customer.isActive && !!user.isActive,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isActive: !!user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      accounts: accountsList.map((a) => ({ ...a, balance: Number(a.balance) })),
      recentTransactions: recent,
    };
  }

  async create(dto: CreateCustomerDto, actorId: string, meta?: any) {
    const email = dto.email.toLowerCase().trim();
    if (users.first('email = ?', [email])) {
      throw new ConflictException('Un utilisateur existe déjà avec cet e-mail.');
    }
    const hashed = await bcrypt.hash(dto.password, 10);
    const now = nowIso();
    const user = users.insert({
      id: uuid(),
      email,
      password: hashed,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      phone: dto.phone ?? null,
      role: 'CLIENT',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const customer = customers.insert({
      id: uuid(),
      userId: user.id,
      address: dto.address ?? null,
      city: dto.city ?? null,
      country: 'Cameroun',
      isActive: true,
      createdAt: now,
    });
    const account = this.accountsService.openAccount(customer.id, {}, actorId, meta);

    // Dépôt initial optionnel (transaction terminée, sans fraude — action employé).
    if (dto.initialDeposit && dto.initialDeposit > 0) {
      const { txReference } = require('../common/utils');
      transactions.insert({
        id: uuid(),
        reference: txReference(),
        type: 'DEPOSIT',
        status: 'COMPLETED',
        amount: Math.round(dto.initialDeposit),
        sourceAccountId: null,
        targetAccountId: account.id,
        description: 'Dépôt initial à l’ouverture du compte',
        riskScore: 0,
        riskLevel: 'LOW',
        createdByUserId: actorId,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
      accounts.update(account.id, { balance: Number(account.balance) + Math.round(dto.initialDeposit) });
    }

    this.notify.notify(
      user.id,
      'SYSTEM',
      'Bienvenue chez Shield',
      `Votre compte bancaire ${account.accountNumber} a été ouvert avec succès.`,
    );
    this.audit.record({
      userId: actorId,
      action: 'CUSTOMER_CREATED',
      entity: 'CUSTOMER',
      entityId: customer.id,
      description: `Création du client ${user.firstName} ${user.lastName} (${email})`,
      ...meta,
    });
    return this.getDetail(customer.id);
  }

  update(customerId: string, dto: any, actorId: string, meta?: any) {
    const customer = customers.byId(customerId);
    if (!customer) throw new NotFoundException('Client introuvable.');
    const patch: any = {};
    if (dto.address !== undefined) patch.address = dto.address;
    if (dto.city !== undefined) patch.city = dto.city;
    if (Object.keys(patch).length) customers.update(customerId, patch);

    const userPatch: any = { updatedAt: nowIso() };
    let touched = false;
    if (dto.firstName !== undefined) {
      userPatch.firstName = dto.firstName;
      touched = true;
    }
    if (dto.lastName !== undefined) {
      userPatch.lastName = dto.lastName;
      touched = true;
    }
    if (dto.phone !== undefined) {
      userPatch.phone = dto.phone;
      touched = true;
    }
    if (touched) users.update(customer.userId, userPatch);

    this.audit.record({
      userId: actorId,
      action: 'CUSTOMER_UPDATED',
      entity: 'CUSTOMER',
      entityId: customerId,
      description: 'Mise à jour des informations client',
      ...meta,
    });
    return this.getDetail(customerId);
  }

  /** Le client met à jour ses propres informations autorisées. */
  updateSelf(userId: string, dto: any) {
    const customer = customers.first('user_id = ?', [userId]);
    if (!customer) throw new NotFoundException('Profil client introuvable.');
    const patch: any = {};
    if (dto.address !== undefined) patch.address = dto.address;
    if (dto.city !== undefined) patch.city = dto.city;
    if (Object.keys(patch).length) customers.update(customer.id, patch);
    const userPatch: any = { updatedAt: nowIso() };
    if (dto.phone !== undefined) userPatch.phone = dto.phone;
    if (dto.firstName !== undefined) userPatch.firstName = dto.firstName;
    if (dto.lastName !== undefined) userPatch.lastName = dto.lastName;
    users.update(userId, userPatch);
    this.audit.record({
      userId,
      action: 'PROFILE_UPDATED',
      entity: 'USER',
      entityId: userId,
      description: 'Mise à jour du profil par le client',
    });
    return this.getDetail(customer.id);
  }
}
