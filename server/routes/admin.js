const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

router.use(adminAuth);

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT
      u.id, u.name, u.email, u.role, u.disabled, u.created_at,
      (SELECT COUNT(*) FROM bills WHERE user_id = u.id) as bill_count,
      (SELECT COUNT(*) FROM loans WHERE user_id = u.id) as loan_count
    FROM users u
    ORDER BY u.created_at ASC
  `).all();
  res.json(users);
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ success: true });
});

// PUT /api/admin/users/:id/disable
router.put('/users/:id/disable', (req, res) => {
  const user = db.prepare('SELECT disabled FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const newDisabled = user.disabled === 1 ? 0 : 1;
  db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(newDisabled, req.params.id);
  res.json({ success: true, disabled: newDisabled });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM bills WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM split_payments WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM loans WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM transactions WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM savings_goals WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM budget_members WHERE user_id = ?').run(id);
  // Delete budgets owned by user
  const ownedBudgets = db.prepare('SELECT id FROM budgets WHERE owner_id = ?').all(id);
  for (const b of ownedBudgets) {
    db.prepare('DELETE FROM budget_members WHERE budget_id = ?').run(b.id);
    db.prepare('DELETE FROM budgets WHERE id = ?').run(b.id);
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'newPassword required' });
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ success: true });
});

// POST /api/admin/users/:id/impersonate
router.post('/users/:id/impersonate', (req, res) => {
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const token = jwt.sign({ ...user, impersonated: true, originalId: req.user.id }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, user });
});

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalBills = db.prepare('SELECT COUNT(*) as c FROM bills').get().c;
  const totalLoans = db.prepare('SELECT COUNT(*) as c FROM loans').get().c;
  const totalLoanVolume = db.prepare('SELECT COALESCE(SUM(original_amount), 0) as s FROM loans').get().s;
  const totalSplitPayments = db.prepare('SELECT COUNT(*) as c FROM split_payments').get().c;
  const totalTransactions = db.prepare('SELECT COUNT(*) as c FROM transactions').get().c;
  const totalSavingsGoals = db.prepare('SELECT COUNT(*) as c FROM savings_goals').get().c;

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const newUsersThisMonth = db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= ?").get(firstOfMonth).c;

  const signupsByMonth = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
    FROM users
    WHERE created_at >= date('now', '-12 months')
    GROUP BY month
    ORDER BY month ASC
  `).all();

  res.json({
    totalUsers,
    totalBills,
    totalLoans,
    totalLoanVolume,
    totalSplitPayments,
    totalTransactions,
    totalSavingsGoals,
    newUsersThisMonth,
    signupsByMonth
  });
});

// GET /api/admin/budgets
router.get('/budgets', (req, res) => {
  const budgets = db.prepare(`
    SELECT b.id, b.name, b.created_at,
      u.name as owner_name, u.email as owner_email,
      (SELECT COUNT(*) FROM budget_members WHERE budget_id = b.id) as member_count
    FROM budgets b
    JOIN users u ON u.id = b.owner_id
    ORDER BY b.created_at DESC
  `).all();
  res.json(budgets);
});

// DELETE /api/admin/budgets/:id
router.delete('/budgets/:id', (req, res) => {
  db.prepare('DELETE FROM budget_members WHERE budget_id = ?').run(req.params.id);
  db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/admin/settings
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

// PUT /api/admin/settings
router.put('/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, String(value));
  res.json({ success: true });
});

// GET /api/admin/invites
router.get('/invites', (req, res) => {
  const invites = db.prepare(`
    SELECT i.id, i.token, i.created_at, i.used_at, i.expires_at,
           c.name as created_by_name,
           u.name as used_by_name
    FROM invites i
    JOIN users c ON c.id = i.created_by
    LEFT JOIN users u ON u.id = i.used_by
    ORDER BY i.created_at DESC
  `).all();
  res.json(invites);
});

// POST /api/admin/invites
router.post('/invites', (req, res) => {
  const { expiresInDays } = req.body;
  const token = crypto.randomBytes(24).toString('hex');
  let expires_at = null;
  if (expiresInDays) {
    const d = new Date();
    d.setDate(d.getDate() + Number(expiresInDays));
    expires_at = d.toISOString();
  }
  db.prepare('INSERT INTO invites (token, created_by, expires_at) VALUES (?, ?, ?)').run(token, req.user.id, expires_at);
  res.json({ token });
});

// DELETE /api/admin/invites/:id
router.delete('/invites/:id', (req, res) => {
  db.prepare('DELETE FROM invites WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
