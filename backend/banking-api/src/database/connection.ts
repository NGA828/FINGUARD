/**
 * Connexion SQLite (node:sqlite) — adaptateur d'exécution de Shield.
 * En production, la couche d'accès aux données est Prisma + MySQL
 * (voir prisma/schema.prisma). Les repositories ci-dessous isolent le SQL
 * pour rendre ce changement transparent pour la logique métier.
 */
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.resolve(process.cwd(), process.env.SQLITE_PATH || './data/finguard.db');

let db: any = null;

export function getConnection(): any {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
    initSchema();
  }
  return db;
}

function initSchema() {
  const ddl = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(ddl);
  ensureTransactionPaymentColumns();
}

function ensureTransactionPaymentColumns() {
  const columns = db
    .prepare('PRAGMA table_info(transactions)')
    .all()
    .map((column: any) => column.name);

  if (!columns.includes('payment_method')) {
    db.exec(
      "ALTER TABLE transactions ADD COLUMN payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('ORANGE_MONEY','MTN_MOMO'))",
    );
  }
  if (!columns.includes('payment_phone')) {
    db.exec('ALTER TABLE transactions ADD COLUMN payment_phone TEXT');
  }
}

export function resetDatabase() {
  const conn = getConnection();
  const tables = conn
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r: any) => r.name);
  conn.exec('PRAGMA foreign_keys = OFF;');
  for (const t of tables) conn.exec(`DROP TABLE IF EXISTS ${t};`);
  conn.exec('PRAGMA foreign_keys = ON;');
  initSchema();
}

// node:sqlite refuse `undefined` comme paramètre ; on le normalise en NULL.
const clean = (params: any[]) => params.map((p) => (p === undefined ? null : p));

export function query<T = any>(sql: string, params: any[] = []): T[] {
  return getConnection().prepare(sql).all(...clean(params)) as T[];
}

export function one<T = any>(sql: string, params: any[] = []): T | null {
  return (getConnection().prepare(sql).get(...clean(params)) as T) ?? null;
}

export function run(sql: string, params: any[] = []): void {
  getConnection().prepare(sql).run(...clean(params));
}

/** Exécute un bloc dans une transaction SQL (atomicité des opérations bancaires). */
export function tx<T>(fn: () => T): T {
  const conn = getConnection();
  conn.exec('BEGIN');
  try {
    const result = fn();
    conn.exec('COMMIT');
    return result;
  } catch (e) {
    conn.exec('ROLLBACK');
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Conversion camelCase <-> snake_case
// ---------------------------------------------------------------------------
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

function prepareValue(v: any): any {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === undefined) return null;
  return v;
}

export function rowToCamel(row: any): any {
  if (!row) return row;
  const out: any = {};
  for (const k of Object.keys(row)) out[toCamel(k)] = row[k];
  return out;
}

/** Repository générique : isoler le SQL par table. */
export class Repo {
  constructor(
    public table: string,
    public pk: string = 'id',
  ) {}

  all(where?: string, params: any[] = [], orderBy?: string, limit?: number): any[] {
    let sql = `SELECT * FROM ${this.table}`;
    if (where) sql += ` WHERE ${where}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${limit}`;
    return query(sql, params).map(rowToCamel);
  }

  first(where?: string, params: any[] = [], orderBy?: string): any {
    let sql = `SELECT * FROM ${this.table}`;
    if (where) sql += ` WHERE ${where}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    sql += ' LIMIT 1';
    return rowToCamel(one(sql, params));
  }

  byId(id: string): any {
    return rowToCamel(one(`SELECT * FROM ${this.table} WHERE ${this.pk} = ?`, [id]));
  }

  insert(obj: Record<string, any>): any {
    const keys = Object.keys(obj).map(toSnake);
    const values = Object.keys(obj).map((k) => prepareValue(obj[k]));
    const placeholders = keys.map(() => '?').join(', ');
    run(`INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`, values);
    return this.byId(obj[this.pk] ?? obj[toSnake(this.pk)]);
  }

  update(id: string, obj: Record<string, any>): any {
    const keys = Object.keys(obj).map(toSnake);
    const values = Object.keys(obj).map((k) => prepareValue(obj[k]));
    run(`UPDATE ${this.table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ${this.pk} = ?`, [
      ...values,
      id,
    ]);
    return this.byId(id);
  }

  count(where?: string, params: any[] = []): number {
    let sql = `SELECT COUNT(*) AS c FROM ${this.table}`;
    if (where) sql += ` WHERE ${where}`;
    return (one(sql, params) as any).c;
  }

  remove(where: string, params: any[] = []): void {
    run(`DELETE FROM ${this.table} WHERE ${where}`, params);
  }

  sum(column: string, where?: string, params: any[] = []): number {
    let sql = `SELECT COALESCE(SUM(${toSnake(column)}), 0) AS s FROM ${this.table}`;
    if (where) sql += ` WHERE ${where}`;
    return (one(sql, params) as any).s;
  }
}

export const users = new Repo('users');
export const customers = new Repo('customers');
export const employees = new Repo('employees');
export const accounts = new Repo('accounts');
export const transactions = new Repo('transactions');
export const fraudAnalyses = new Repo('fraud_analyses');
export const fraudAlerts = new Repo('fraud_alerts');
export const disputes = new Repo('disputes');
export const disputeNotes = new Repo('dispute_notes');
export const notifications = new Repo('notifications');
export const auditLogs = new Repo('audit_logs');
export const systemConfig = new Repo('system_config', 'key');
export const fraudRules = new Repo('fraud_rules');
export const beneficiaries = new Repo('beneficiaries');
