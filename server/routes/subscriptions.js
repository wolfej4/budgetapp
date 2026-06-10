const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', (req, res) => {
  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY active DESC, name ASC').all(req.user.id);
  res.json(subs);
});

router.post('/', (req, res) => {
  const { name, amount, billing_cycle, due_day, renewal_date, category, notes } = req.body;
  if (!name || amount == null) {
    return res.status(400).json({ error: 'name and amount are required' });
  }
  if (billing_cycle === 'monthly' && !due_day) {
    return res.status(400).json({ error: 'due_day is required for monthly subscriptions' });
  }
  if (billing_cycle === 'yearly' && !renewal_date) {
    return res.status(400).json({ error: 'renewal_date is required for yearly subscriptions' });
  }
  const result = db.prepare(
    'INSERT INTO subscriptions (user_id, name, amount, billing_cycle, due_day, renewal_date, category, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, name, amount, billing_cycle || 'monthly', due_day || null, renewal_date || null, category || 'other', notes || null);
  res.json(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  const { name, amount, billing_cycle, due_day, renewal_date, category, active, notes } = req.body;
  db.prepare(
    `UPDATE subscriptions SET
      name = ?, amount = ?, billing_cycle = ?, due_day = ?, renewal_date = ?, category = ?, active = ?, notes = ?
     WHERE id = ?`
  ).run(
    name ?? sub.name,
    amount ?? sub.amount,
    billing_cycle ?? sub.billing_cycle,
    due_day !== undefined ? due_day : sub.due_day,
    renewal_date !== undefined ? renewal_date : sub.renewal_date,
    category ?? sub.category,
    active !== undefined ? (active ? 1 : 0) : sub.active,
    notes !== undefined ? notes : sub.notes,
    sub.id
  );
  res.json(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(sub.id));
});

router.delete('/:id', (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  db.prepare('DELETE FROM subscriptions WHERE id = ?').run(sub.id);
  res.json({ success: true });
});

module.exports = router;
