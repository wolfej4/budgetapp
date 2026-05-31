const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', (req, res) => {
  const goals = db.prepare('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json(goals);
});

router.post('/', (req, res) => {
  const { name, target_amount, current_amount, target_date, category, notes } = req.body;
  if (!name || target_amount == null) {
    return res.status(400).json({ error: 'name and target_amount are required' });
  }
  const result = db.prepare(
    'INSERT INTO savings_goals (user_id, name, target_amount, current_amount, target_date, category, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, name, target_amount, current_amount || 0, target_date || null, category || 'general', notes || null);
  res.json(db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const { name, target_amount, current_amount, target_date, category, notes } = req.body;
  db.prepare(
    'UPDATE savings_goals SET name=?, target_amount=?, current_amount=?, target_date=?, category=?, notes=? WHERE id=?'
  ).run(
    name ?? goal.name,
    target_amount ?? goal.target_amount,
    current_amount ?? goal.current_amount,
    target_date ?? goal.target_date,
    category ?? goal.category,
    notes ?? goal.notes,
    goal.id
  );
  res.json(db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goal.id));
});

router.put('/:id/contribute', (req, res) => {
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const { amount } = req.body;
  if (amount == null || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
  const newAmount = goal.current_amount + amount;
  db.prepare('UPDATE savings_goals SET current_amount=? WHERE id=?').run(newAmount, goal.id);
  res.json(db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goal.id));
});

router.delete('/:id', (req, res) => {
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  db.prepare('DELETE FROM savings_goals WHERE id = ?').run(goal.id);
  res.json({ success: true });
});

module.exports = router;
