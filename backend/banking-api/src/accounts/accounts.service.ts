import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { accounts, customers, users, transactions } from '../database/connection';
import { accountNumber, nowIso, uuid } from '../common/utils';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AccountsService {
  constructor(private readonly audit: AuditService) {}

  getForCustomer(customerId: string) {
    return accounts.all('customer_id = ?', [customerId], 'opened_at ASC');
  }

  getWithCustomer(accountId: string) {
    const account = accounts.byId(accountId);
    if (!account) throw new NotFoundException('Compte introuvable.');
    const customer = customers.byId(account.customerId);
    const user = customer ? users.byId(customer.userId) : null;
    return {
      ...account,
      balance: Number(account.balance),
      customer: customer && user
        ? {
            id: customer.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            phone: user.phone,
            isActive: !!customer.isActive && !!user.isActive,
          }
        : null,
    };
  }

  openAccount(
    customerId: string,
    opts: { dailyLimit?: number; perTxLimit?: number },
    actorId: string,
    meta?: any,
  ) {
    const customer = customers.byId(customerId);
    if (!customer) throw new NotFoundException('Client introuvable.');
    const seq = accounts.count() + 10000101;
    const account = accounts.insert({
      id: uuid(),
      accountNumber: accountNumber(seq),
      customerId,
      balance: 0,
      status: 'ACTIVE',
      dailyLimit: opts.dailyLimit ?? 5000000,
      perTxLimit: opts.perTxLimit ?? 2000000,
      openedAt: nowIso(),
    });
    this.audit.record({
      userId: actorId,
      action: 'ACCOUNT_CREATED',
      entity: 'ACCOUNT',
      entityId: account.id,
      description: `Ouverture du compte ${account.accountNumber}`,
      ...meta,
    });
    return account;
  }

  freeze(accountId: string, reason: string | undefined, actorId: string, meta?: any) {
    const account = accounts.byId(accountId);
    if (!account) throw new NotFoundException('Compte introuvable.');
    if (account.status !== 'ACTIVE') {
      throw new BadRequestException('Seul un compte actif peut être gelé.');
    }
    const updated = accounts.update(accountId, {
      status: 'FROZEN',
      frozenReason: reason || 'Gel demandé par la banque',
      frozenAt: nowIso(),
    });
    this.audit.record({
      userId: actorId,
      action: 'ACCOUNT_FROZEN',
      entity: 'ACCOUNT',
      entityId: accountId,
      description: `Gel du compte ${account.accountNumber}${reason ? ` — ${reason}` : ''}`,
      ...meta,
    });
    return updated;
  }

  unfreeze(accountId: string, actorId: string, meta?: any) {
    const account = accounts.byId(accountId);
    if (!account) throw new NotFoundException('Compte introuvable.');
    if (account.status !== 'FROZEN') {
      throw new BadRequestException('Seul un compte gelé peut être dégelé.');
    }
    const updated = accounts.update(accountId, {
      status: 'ACTIVE',
      frozenReason: null,
      frozenAt: null,
    });
    this.audit.record({
      userId: actorId,
      action: 'ACCOUNT_UNFROZEN',
      entity: 'ACCOUNT',
      entityId: accountId,
      description: `Dégel du compte ${account.accountNumber}`,
      ...meta,
    });
    return updated;
  }

  search(q?: string) {
    const where: string[] = [];
    const params: any[] = [];
    if (q) {
      where.push(
        "(accounts.account_number LIKE ? OR accounts.id IN (SELECT a2.id FROM accounts a2 JOIN customers c2 ON c2.id = a2.customer_id JOIN users u2 ON u2.id = c2.user_id WHERE u2.first_name LIKE ? OR u2.last_name LIKE ? OR u2.email LIKE ?))",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const rows = transactions as any; // silence unused
    void rows;
    const list = this.rawSearch(where.length ? where.join(' AND ') : undefined, params);
    return list;
  }

  private rawSearch(where?: string, params: any[] = []) {
    const { query, rowToCamel } = require('../database/connection');
    let sql = `
      SELECT a.*, u.first_name, u.last_name, u.email
      FROM accounts a
      JOIN customers c ON c.id = a.customer_id
      JOIN users u ON u.id = c.user_id
    `;
    if (where) sql += ` WHERE ${where.replaceAll('accounts.', 'a.')}`;
    sql += ' ORDER BY a.opened_at DESC LIMIT 200';
    return query(sql, params).map((r: any) => {
      const row = rowToCamel(r);
      return {
        ...row,
        balance: Number(row.balance),
        customerName: `${row.firstName} ${row.lastName}`,
        email: row.email,
      };
    });
  }
}
