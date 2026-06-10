const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'budget.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS budget_members (
  budget_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'viewer',
  PRIMARY KEY(budget_id, user_id),
  FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  budget_id INTEGER,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  due_day INTEGER NOT NULL,
  recurrence TEXT DEFAULT 'monthly',
  due_date TEXT,
  category TEXT,
  notes TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS split_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  budget_id INTEGER,
  provider TEXT NOT NULL,
  description TEXT NOT NULL,
  marketplace TEXT,
  total_amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS split_payment_installments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  split_payment_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  paid INTEGER DEFAULT 0,
  FOREIGN KEY(split_payment_id) REFERENCES split_payments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  budget_id INTEGER,
  name TEXT NOT NULL,
  original_amount REAL NOT NULL,
  current_balance REAL NOT NULL,
  interest_rate REAL NOT NULL,
  monthly_payment REAL NOT NULL,
  start_date TEXT NOT NULL,
  category TEXT DEFAULT 'auto',
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  recurrence TEXT DEFAULT 'one-time',
  category TEXT DEFAULT 'job',
  notes TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0,
  target_date TEXT,
  category TEXT DEFAULT 'general',
  notes TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  payee TEXT NOT NULL,
  category TEXT DEFAULT 'Other',
  amount REAL NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  billing_cycle TEXT DEFAULT 'monthly',
  due_day INTEGER,
  renewal_date TEXT,
  category TEXT DEFAULT 'other',
  active INTEGER DEFAULT 1,
  notes TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

// Safely add role column to users
const userCols = db.prepare('PRAGMA table_info(users)').all();
if (!userCols.find(c => c.name === 'role')) {
  db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'").run();
}

// Safely add disabled column to users
if (!userCols.find(c => c.name === 'disabled')) {
  db.prepare('ALTER TABLE users ADD COLUMN disabled INTEGER DEFAULT 0').run();
}

// Safely add marketplace column to split_payments
const splitCols = db.prepare('PRAGMA table_info(split_payments)').all();
if (!splitCols.find(c => c.name === 'marketplace')) {
  db.prepare('ALTER TABLE split_payments ADD COLUMN marketplace TEXT').run();
}

// One-time migration: copy legacy income entries into transactions as inflows
const txCount = db.prepare('SELECT COUNT(*) as c FROM transactions').get().c;
if (txCount === 0) {
  const incomeRows = db.prepare('SELECT * FROM income').all();
  const insertTx = db.prepare(
    'INSERT INTO transactions (user_id, date, payee, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const row of incomeRows) {
    insertTx.run(row.user_id, row.date, row.source, 'Income', Math.abs(row.amount), row.notes || null);
  }
}

// Seed default settings
db.prepare("INSERT OR IGNORE INTO app_settings VALUES ('registration_open', '1')").run();

module.exports = db;
