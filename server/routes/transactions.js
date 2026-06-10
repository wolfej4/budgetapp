const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// GET /api/transactions?year=2026&month=5  (month is 0-indexed to match the client)
router.get('/', (req, res) => {
  const { year, month } = req.query;
  if (year !== undefined && month !== undefined) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10) + 1;
    const prefix = `${y}-${String(m).padStart(2, '0')}`;
    const rows = db.prepare(
      "SELECT * FROM transactions WHERE user_id = ? AND date LIKE ? || '%' ORDER BY date DESC, id DESC"
    ).all(req.user.id, prefix);
    return res.json(rows);
  }
  const rows = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC').all(req.user.id);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { date, payee, category, amount, notes } = req.body;
  if (!date || !payee || amount == null || isNaN(amount) || Number(amount) === 0) {
    return res.status(400).json({ error: 'date, payee, and a non-zero amount are required' });
  }
  const result = db.prepare(
    'INSERT INTO transactions (user_id, date, payee, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, date, payee, category || 'Other', Number(amount), notes || null);
  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  const { date, payee, category, amount, notes } = req.body;
  db.prepare(
    'UPDATE transactions SET date = ?, payee = ?, category = ?, amount = ?, notes = ? WHERE id = ?'
  ).run(
    date ?? tx.date,
    payee ?? tx.payee,
    category ?? tx.category,
    amount != null ? Number(amount) : tx.amount,
    notes !== undefined ? notes : tx.notes,
    tx.id
  );
  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(tx.id));
});

router.delete('/:id', (req, res) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
  res.json({ success: true });
});

module.exports = router;
