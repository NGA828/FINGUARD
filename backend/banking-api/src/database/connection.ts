/**
 * Synchronous repository facade backed by MySQL.
 *
 * The application was written around node:sqlite's synchronous API.  mysql2
 * is asynchronous, so a dedicated worker owns the connection and communicates
 * through a SharedArrayBuffer.  This keeps the repository API (and therefore
 * all service behaviour) unchanged while using a real MySQL connection.
 */
import '../env';
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const BUFFER_SIZE = 8 * 1024 * 1024;
const DATA_OFFSET = 8;

let worker: Worker | null = null;
let shared: SharedArrayBuffer | null = null;
let control: Int32Array | null = null;

const workerSource = `
const { parentPort, workerData } = require('worker_threads');
const mysql = require('mysql2/promise');
const sab = workerData.sab;
const control = new Int32Array(sab, 0, 2);
const data = Buffer.from(sab, ${DATA_OFFSET});
let connection;
function readRequest() {
  const length = Atomics.load(control, 1);
  return JSON.parse(data.subarray(0, length).toString('utf8'));
}
function writeResponse(value) {
  const encoded = Buffer.from(JSON.stringify(value), 'utf8');
  if (encoded.length > data.length) throw new Error('Database response is too large');
  encoded.copy(data);
  Atomics.store(control, 1, encoded.length);
  Atomics.store(control, 0, 2);
  Atomics.notify(control, 0);
}
function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}
function mysqlConfig() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'shield',
    charset: 'utf8mb4',
    multipleStatements: false,
  };
}
async function initialize() {
  if (!connection) connection = await mysql.createConnection(mysqlConfig());
  const ddl = workerData.schema
    .replace(/^\\s*PRAGMA[^;]*;\\s*$/gim, '')
    .replace(/\\bTEXT\\b/g, 'VARCHAR(255)');
  for (const statement of ddl
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)) {
    await connection.query(statement);
  }
}
async function execute(request) {
  if (request.kind === 'init') {
    await initialize();
    return null;
  }
  if (request.kind === 'query') {
    const [rows] = await connection.execute(request.sql, request.params);
    return rows;
  }
  if (request.kind === 'run') {
    await connection.execute(request.sql, request.params);
    return null;
  }
  if (request.kind === 'begin' || request.kind === 'commit' || request.kind === 'rollback') {
    await connection.query(request.kind.toUpperCase());
    return null;
  }
}
(async () => {
  try {
    await initialize();
    Atomics.store(control, 0, 3);
    Atomics.notify(control, 0);
    // Wait for the caller to acknowledge readiness before accepting requests.
    Atomics.wait(control, 0, 3);
    for (;;) {
      Atomics.wait(control, 0, 0);
      const request = readRequest();
      try { writeResponse({ ok: true, value: await execute(request) }); }
      catch (error) { writeResponse({ ok: false, error: errorMessage(error) }); }
      // Wait for the caller to acknowledge the response before receiving
      // another request. Otherwise state=2 is mistaken for a new request.
      Atomics.wait(control, 0, 2);
    }
  } catch (error) {
    writeResponse({ ok: false, error: errorMessage(error) });
  }
})();
`;

function ensureWorker() {
  if (worker) return;
  shared = new SharedArrayBuffer(BUFFER_SIZE);
  control = new Int32Array(shared, 0, 2);
  worker = new Worker(workerSource, { eval: true, workerData: { sab: shared, schema } });
  worker.unref();
  const result = Atomics.wait(control, 0, 0, 30000);
  if (result === 'timed-out') {
    throw new Error('Timed out while initializing MySQL connection. Check MariaDB availability and credentials.');
  }
  if (Atomics.load(control, 0) === 2) readResponse();
  if (Atomics.load(control, 0) !== 3) {
    throw new Error('Unable to initialize MySQL connection');
  }
  Atomics.store(control, 0, 0);
  Atomics.notify(control, 0);
}

function readResponse(): any {
  const length = Atomics.load(control!, 1);
  const response = JSON.parse(Buffer.from(shared!, DATA_OFFSET, length).toString('utf8'));
  Atomics.store(control!, 0, 0);
  Atomics.notify(control!, 0);
  if (!response.ok) throw new Error(response.error);
  return response.value;
}

function request(kind: string, sql = '', params: any[] = []): any {
  ensureWorker();
  const payload = Buffer.from(JSON.stringify({ kind, sql, params: clean(params) }), 'utf8');
  if (payload.length > BUFFER_SIZE - DATA_OFFSET) throw new Error('Database request is too large');
  payload.copy(Buffer.from(shared!, DATA_OFFSET));
  Atomics.store(control!, 1, payload.length);
  Atomics.store(control!, 0, 1);
  Atomics.notify(control!, 0);
  const result = Atomics.wait(control!, 0, 1, 30000);
  if (result === 'timed-out') {
    throw new Error(`Timed out waiting for MySQL operation: ${kind}`);
  }
  if (Atomics.load(control!, 0) !== 2) {
    throw new Error('MySQL worker stopped before returning a response');
  }
  return readResponse();
}

export function getConnection(): any {
  ensureWorker();
  return worker;
}

export function resetDatabase() {
  const rawTables = query<{ TABLE_NAME: string }>(
    "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
  const tables = Array.isArray(rawTables) ? rawTables : Object.values(rawTables || {});
  run('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables as Array<{ TABLE_NAME: string }>) {
    run(`DROP TABLE IF EXISTS \`${table.TABLE_NAME}\``);
  }
  run('SET FOREIGN_KEY_CHECKS = 1');
  request('init');
}

/** Remove application data while keeping the existing MySQL schema. */
export function clearDatabaseData() {
  const tables = query<{ TABLE_NAME: string }>(
    "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
  run('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    run(`DELETE FROM \`${table.TABLE_NAME}\``);
  }
  run('SET FOREIGN_KEY_CHECKS = 1');
}

const clean = (params: any[]) => params.map((p) => (p === undefined ? null : p));

export function query<T = any>(sql: string, params: any[] = []): T[] {
  return (request('query', sql, params) || []) as T[];
}

export function one<T = any>(sql: string, params: any[] = []): T | null {
  return (query<T>(sql, params)[0] as T) ?? null;
}

export function run(sql: string, params: any[] = []): void {
  request('run', sql, params);
}

export function tx<T>(fn: () => T): T {
  request('begin');
  try {
    const result = fn();
    request('commit');
    return result;
  } catch (error) {
    request('rollback');
    throw error;
  }
}

const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const sqlColumn = (column: string) => column === 'key' ? '`key`' : column;

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

export class Repo {
  constructor(public table: string, public pk: string = 'id') {}
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
    return rowToCamel(one(`SELECT * FROM ${this.table} WHERE ${sqlColumn(this.pk)} = ?`, [id]));
  }
  insert(obj: Record<string, any>): any {
    const keys = Object.keys(obj).map(toSnake);
    const values = Object.keys(obj).map((k) => prepareValue(obj[k]));
    run(`INSERT INTO ${this.table} (${keys.map(sqlColumn).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, values);
    return this.byId(obj[this.pk] ?? obj[toSnake(this.pk)]);
  }
  update(id: string, obj: Record<string, any>): any {
    const keys = Object.keys(obj).map(toSnake);
    run(`UPDATE ${this.table} SET ${keys.map((k) => `${sqlColumn(k)} = ?`).join(', ')} WHERE ${sqlColumn(this.pk)} = ?`, [
      ...Object.keys(obj).map((k) => prepareValue(obj[k])),
      id,
    ]);
    return this.byId(id);
  }
  count(where?: string, params: any[] = []): number {
    return (one<any>(`SELECT COUNT(*) AS c FROM ${this.table}${where ? ` WHERE ${where}` : ''}`, params) as any).c;
  }
  remove(where: string, params: any[] = []): void { run(`DELETE FROM ${this.table} WHERE ${where}`, params); }
  sum(column: string, where?: string, params: any[] = []): number {
    return (one<any>(`SELECT COALESCE(SUM(${toSnake(column)}), 0) AS s FROM ${this.table}${where ? ` WHERE ${where}` : ''}`, params) as any).s;
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
