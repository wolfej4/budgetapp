const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

function expandRecurring(income, year, month) {
  // Returns array of effective amounts for the given month
  const results = [];
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  for (const item of income) {
    const itemDate = new Date(item.date);
    if (item.recurrence === 'one-time') {
      if (itemDate.getFullYear() === year && itemDate.getMonth() === month) {
        results.push(item);
      }
    } else if (item.recurrence === 'monthly') {
      if (itemDate <= monthEnd) {
        results.push({ ...item, date: new Date(year, month, itemDate.getDate()).toISOString().slice(0, 10) });
      }
    } else if (item.recurrence === 'weekly') {
      if (itemDate <= monthEnd) {
        let d = new Date(itemDate);
        while (d <= monthEnd) {
          if (d >= monthStart) {
            results.push({ ...item, date: d.toISOString().slice(0, 10) });
          }
          d = new Date(d.getTime() + 7 * 86400000);
        }
      }
    } else if (item.recurrence === 'biweekly') {
      if (itemDate <= monthEnd) {
        let d = new Date(itemDate);
        while (d <= monthEnd) {
          if (d >= monthStart) {
            results.push({ ...item, date: d.toISOString().slice(0, 10) });
          }
          d = new Date(d.getTime() + 14 * 86400000);
        }
      }
    }
  }
  return results;
}

router.get('/', (req, res) => {
  const income = db.prepare('SELECT * FROM income WHERE user_id = ? ORDER BY date DESC').all(req.user.id);
  const { year, month } = req.query;
  if (year && month !== undefined) {
    const expanded = expandRecurring(income, parseInt(year), parseInt(month));
    return res.json(expanded);
  }
  res.json(income);
});

router.post('/', (req, res) => {
  const { source, amount, date, recurrence, category, notes } = req.body;
  if (!source || amount == null || !date) {
    return res.status(400).json({ error: 'source, amount, and date are required' });
  }
  const result = db.prepare(
    'INSERT INTO income (user_id, source, amount, date, recurrence, category, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, source, amount, date, recurrence || 'one-time', category || 'job', notes || null);
  res.json(db.prepare('SELECT * FROM income WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM income WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Income not found' });
  const { source, amount, date, recurrence, category, notes } = req.body;
  db.prepare(
    'UPDATE income SET source=?, amount=?, date=?, recurrence=?, category=?, notes=? WHERE id=?'
  ).run(
    source ?? item.source,
    amount ?? item.amount,
    date ?? item.date,
    recurrence ?? item.recurrence,
    category ?? item.category,
    notes ?? item.notes,
    item.id
  );
  res.json(db.prepare('SELECT * FROM income WHERE id = ?').get(item.id));
});

router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM income WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Income not found' });
  db.prepare('DELETE FROM income WHERE id = ?').run(item.id);
  res.json({ success: true });
});

module.exports = router;
module.exports.expandRecurring = expandRecurring;
