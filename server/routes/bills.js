const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', (req, res) => {
  const bills = db.prepare('SELECT * FROM bills WHERE user_id = ? ORDER BY due_day ASC').all(req.user.id);
  res.json(bills);
});

router.post('/', (req, res) => {
  const { name, amount, due_day, recurrence, due_date, category, notes, budget_id } = req.body;
  if (!name || amount == null || due_day == null) {
    return res.status(400).json({ error: 'name, amount, and due_day are required' });
  }
  const result = db.prepare(
    'INSERT INTO bills (user_id, budget_id, name, amount, due_day, recurrence, due_date, category, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, budget_id || null, name, amount, due_day, recurrence || 'monthly', due_date || null, category || null, notes || null);
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(result.lastInsertRowid);
  res.json(bill);
});

router.put('/:id', (req, res) => {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  const { name, amount, due_day, recurrence, due_date, category, notes, budget_id } = req.body;
  db.prepare(
    'UPDATE bills SET name=?, amount=?, due_day=?, recurrence=?, due_date=?, category=?, notes=?, budget_id=? WHERE id=?'
  ).run(
    name ?? bill.name,
    amount ?? bill.amount,
    due_day ?? bill.due_day,
    recurrence ?? bill.recurrence,
    due_date ?? bill.due_date,
    category ?? bill.category,
    notes ?? bill.notes,
    budget_id ?? bill.budget_id,
    bill.id
  );
  res.json(db.prepare('SELECT * FROM bills WHERE id = ?').get(bill.id));
});

router.delete('/:id', (req, res) => {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  db.prepare('DELETE FROM bills WHERE id = ?').run(bill.id);
  res.json({ success: true });
});

module.exports = router;
