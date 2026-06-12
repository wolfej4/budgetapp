const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

function withBalance(account, userId) {
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as balance FROM transactions WHERE user_id = ? AND account_id = ?'
  ).get(userId, account.id);
  return { ...account, balance: row.balance };
}

router.get('/', (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at').all(req.user.id);
  res.json(accounts.map(a => withBalance(a, req.user.id)));
});

router.post('/', (req, res) => {
  const { name, type, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = db.prepare(
    'INSERT INTO accounts (user_id, name, type, color) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, name, type || 'checking', color || '#6366f1');
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
  res.json({ ...account, balance: 0 });
});

router.put('/:id', (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const { name, type, color } = req.body;
  db.prepare('UPDATE accounts SET name = ?, type = ?, color = ? WHERE id = ?').run(
    name ?? account.name,
    type ?? account.type,
    color ?? account.color,
    account.id
  );
  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(account.id);
  res.json(withBalance(updated, req.user.id));
});

router.delete('/:id', (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  db.prepare('UPDATE transactions SET account_id = NULL WHERE account_id = ?').run(account.id);
  db.prepare('DELETE FROM accounts WHERE id = ?').run(account.id);
  res.json({ success: true });
});

module.exports = router;
