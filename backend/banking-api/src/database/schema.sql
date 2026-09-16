-- ============================================================================
-- FinGuard — DDL d'exécution (SQLite via node:sqlite)
-- Correspond 1:1 au schéma MySQL de production : prisma/schema.prisma
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'CLIENT' CHECK (role IN ('CLIENT','EMPLOYEE','ADMIN')),
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Cameroun',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  department TEXT NOT NULL,
  hired_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  account_number TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','FROZEN','CLOSED')),
  daily_limit INTEGER NOT NULL DEFAULT 5000000,
  per_tx_limit INTEGER NOT NULL DEFAULT 2000000,
  frozen_reason TEXT,
  opened_at TEXT NOT NULL,
  frozen_at TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DEPOSIT','WITHDRAWAL','TRANSFER','PAYMENT')),
  status TEXT NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','REJECTED','UNDER_REVIEW','CANCELLED')),
  amount INTEGER NOT NULL,
  source_account_id TEXT REFERENCES accounts(id),
  target_account_id TEXT REFERENCES accounts(id),
  beneficiary_name TEXT,
  description TEXT,
  external_reference TEXT,
  requires_verification INTEGER NOT NULL DEFAULT 0,
  status_reason TEXT,
  risk_score INTEGER,
  risk_level TEXT CHECK (risk_level IS NULL OR risk_level IN ('LOW','MEDIUM','HIGH')),
  created_by_user_id TEXT,
  reviewed_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS fraud_analyses (
  id TEXT PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
  action TEXT NOT NULL CHECK (action IN ('AUTHORIZE','VERIFY','HOLD')),
  indicators TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  analyzed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id),
  level TEXT NOT NULL CHECK (level IN ('LOW','MEDIUM','HIGH')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED','ESCALATED')),
  resolution TEXT CHECK (resolution IS NULL OR resolution IN ('APPROVED','REJECTED','HELD','ESCALATED')),
  notes TEXT,
  assigned_to_id TEXT,
  escalated_to_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','UNDER_REVIEW','INVESTIGATING','RESOLVED','REJECTED','CLOSED')),
  resolution TEXT,
  assigned_to_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS dispute_notes (
  id TEXT PRIMARY KEY,
  dispute_id TEXT NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  author_id TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  transaction_id TEXT REFERENCES transactions(id),
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  description TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'GENERAL',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fraud_rules (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  points INTEGER NOT NULL DEFAULT 10,
  threshold INTEGER,
  param TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beneficiaries (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_label TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (customer_id, account_number)
);

CREATE INDEX IF NOT EXISTS idx_tx_source ON transactions(source_account_id);
CREATE INDEX IF NOT EXISTS idx_tx_target ON transactions(target_account_id);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
