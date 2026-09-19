import { Injectable } from '@nestjs/common';
import { accounts, auditLogs, customers, disputes, fraudAlerts, query, users } from '../database/connection';

/** Rapports opérationnels (employés) et systémiques (administrateurs). */
@Injectable()
export class ReportsService {
  /** Rapport quotidien des transactions sur N jours (employé). */
  daily(days = 7) {
    const n = Math.min(Math.max(Number(days) || 7, 1), 90);
    const since = `DATE_SUB(UTC_DATE(), INTERVAL ${n - 1} DAY)`;
    const rows = query(
      `SELECT DATE(created_at) AS d,
               COUNT(*) AS count,
               COALESCE(SUM(amount), 0) AS volume,
               COALESCE(SUM(CASE WHEN type='DEPOSIT' THEN amount ELSE 0 END), 0) AS deposits,
               COALESCE(SUM(CASE WHEN type='WITHDRAWAL' THEN amount ELSE 0 END), 0) AS withdrawals,
               COALESCE(SUM(CASE WHEN type='TRANSFER' THEN amount ELSE 0 END), 0) AS transfers,
               COALESCE(SUM(CASE WHEN type='PAYMENT' THEN amount ELSE 0 END), 0) AS payments
        FROM transactions
        WHERE created_at >= ${since}
        GROUP BY DATE(created_at)
        ORDER BY d ASC`,
    );
    const flagged = query(
      `SELECT DATE(analyzed_at) AS d, COUNT(*) AS c
       FROM fraud_analyses
       WHERE risk_level IN ('MEDIUM','HIGH') AND analyzed_at >= ${since}
       GROUP BY DATE(analyzed_at)`,
    );
    const flaggedMap = new Map(flagged.map((f: any) => [f.d, f.c]));
    return rows.map((r: any) => ({
      date: r.d,
      count: Number(r.count),
      volume: Number(r.volume),
      deposits: Number(r.deposits),
      withdrawals: Number(r.withdrawals),
      transfers: Number(r.transfers),
      payments: Number(r.payments),
      flagged: Number(flaggedMap.get(r.d) ?? 0),
    }));
  }

  statusDistribution() {
    return query(
      `SELECT status, COUNT(*) AS c FROM transactions GROUP BY status ORDER BY c DESC`,
    ).map((r: any) => ({ status: r.status, count: Number(r.c) }));
  }

  typeDistribution() {
    return query(
      `SELECT type, COUNT(*) AS c, COALESCE(SUM(amount),0) AS volume FROM transactions GROUP BY type`,
    ).map((r: any) => ({ type: r.type, count: Number(r.c), volume: Number(r.volume) }));
  }

  /** Vue d'ensemble système pour l'administrateur. */
  adminOverview() {
    const totals = {
      customers: customers.count(),
      employees: users.count("role = 'EMPLOYEE'"),
      admins: users.count("role = 'ADMIN'"),
      accounts: accounts.count(),
      activeAccounts: accounts.count("status = 'ACTIVE'"),
      frozenAccounts: accounts.count("status = 'FROZEN'"),
      transactions: query('SELECT COUNT(*) AS c FROM transactions')[0].c as number,
      volume30d: Number(
        query(
          `SELECT COALESCE(SUM(amount),0) AS v FROM transactions WHERE status='COMPLETED' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)`,
        )[0].v,
      ),
    };
    const disputesStats = {
      total: disputes.count(),
      open: disputes.count("status IN ('SUBMITTED','UNDER_REVIEW','INVESTIGATING')"),
      resolved: disputes.count("status = 'RESOLVED'"),
      rejected: disputes.count("status = 'REJECTED'"),
    };
    const audit7d = auditLogs.count('created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)');
    const securityEvents = auditLogs.all(
      "action IN ('ACCOUNT_FROZEN','ACCOUNT_UNFROZEN','ALERT_ESCALATED','TRANSACTION_REJECTED','PASSWORD_RESET','DEACTIVATION','LOGIN') AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)",
      [],
      'created_at DESC',
      10,
    );
    return { totals, disputes: disputesStats, auditEventsLast7d: audit7d, securityEvents };
  }

  /** Rapport clients (admin). */
  customersReport() {
    return query(
      `SELECT DATE(c.created_at) AS d, COUNT(*) AS c
       FROM customers c
       WHERE c.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
       GROUP BY DATE(c.created_at)
       ORDER BY d ASC`,
    ).map((r: any) => ({ date: r.d, count: Number(r.c) }));
  }

  /** Activité par client (top volume). */
  topCustomers(limit = 10) {
    return query(
      `SELECT u.first_name || ' ' || u.last_name AS name, u.email,
              COUNT(t.id) AS tx_count, COALESCE(SUM(t.amount),0) AS volume
       FROM transactions t
       JOIN accounts a ON a.id = t.source_account_id OR a.id = t.target_account_id
       JOIN customers c ON c.id = a.customer_id
       JOIN users u ON u.id = c.user_id
       WHERE t.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
       GROUP BY u.id
       ORDER BY volume DESC
       LIMIT ?`,
      [limit],
    ).map((r: any) => ({ name: r.name, email: r.email, txCount: Number(r.tx_count), volume: Number(r.volume) }));
  }
}
