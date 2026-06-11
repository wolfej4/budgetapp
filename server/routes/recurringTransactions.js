const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// Generate transaction dates for a recurring rule up to today
function generateDates(rule, upToDate) {
  const dates = [];
  const start = new Date(rule.start_date + 'T00:00:00');
  const until = new Date(upToDate + 'T00:00:00');
  const end = rule.end_date ? new Date(rule.end_date + 'T00:00:00') : null;
  const lastGen = rule.last_generated ? new Date(rule.last_generated + 'T00:00:00') : null;

  let cursor = new Date(start);

  // Advance cursor past already-generated dates
  if (lastGen) {
    cursor = new Date(lastGen);
    cursor.setDate(cursor.getDate() + 1);
  }

  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  while (cursor <= until) {
    if (end && cursor > end) break;

    let hit = false;
    if (rule.frequency === 'daily') {
      hit = true;
    } else if (rule.frequency === 'weekly') {
      hit = cursor.getDay() === (rule.day_of_week ?? cursor.getDay());
    } else if (rule.frequency === 'biweekly') {
      const diffDays = Math.round((cursor - start) / 86400000);
      hit = diffDays % 14 === 0 && cursor.getDay() === (rule.day_of_week ?? start.getDay());
    } else if (rule.frequency === 'monthly') {
      hit = cursor.getDate() === (rule.day_of_month ?? start.getDate());
    } else if (rule.frequency === 'yearly') {
      hit = cursor.getMonth() === start.getMonth() && cursor.getDate() === start.getDate();
    }

    if (hit) dates.push(fmt(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

// GET /api/recurring-transactions
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
});

// POST /api/recurring-transactions
router.post('/', (req, res) => {
  const { payee, category, amount, notes, frequency, day_of_month, day_of_week, start_date, end_date } = req.body;
  if (!payee || amount == null || !frequency || !start_date) {
    return res.status(400).json({ error: 'payee, amount, frequency, and start_date are required' });
  }
  const result = db.prepare(`
    INSERT INTO recurring_transactions (user_id, payee, category, amount, notes, frequency, day_of_month, day_of_week, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, payee, category || 'Other', Number(amount), notes || null, frequency,
      day_of_month || null, day_of_week != null ? Number(day_of_week) : null, start_date, end_date || null);
  res.json(db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/recurring-transactions/:id
router.put('/:id', (req, res) => {
  const rule = db.prepare('SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!rule) return res.status(404).json({ error: 'Not found' });
  const { payee, category, amount, notes, frequency, day_of_month, day_of_week, start_date, end_date, active } = req.body;
  db.prepare(`
    UPDATE recurring_transactions SET payee=?, category=?, amount=?, notes=?, frequency=?, day_of_month=?, day_of_week=?, start_date=?, end_date=?, active=? WHERE id=?
  `).run(
    payee ?? rule.payee, category ?? rule.category,
    amount != null ? Number(amount) : rule.amount,
    notes !== undefined ? notes : rule.notes,
    frequency ?? rule.frequency,
    day_of_month != null ? day_of_month : rule.day_of_month,
    day_of_week != null ? Number(day_of_week) : rule.day_of_week,
    start_date ?? rule.start_date,
    end_date !== undefined ? end_date : rule.end_date,
    active !== undefined ? (active ? 1 : 0) : rule.active,
    rule.id
  );
  res.json(db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(rule.id));
});

// DELETE /api/recurring-transactions/:id
router.delete('/:id', (req, res) => {
  const rule = db.prepare('SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!rule) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM recurring_transactions WHERE id = ?').run(rule.id);
  res.json({ success: true });
});

// POST /api/recurring-transactions/generate — create pending transactions up to today
router.post('/generate', (req, res) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const rules = db.prepare('SELECT * FROM recurring_transactions WHERE user_id = ? AND active = 1').all(req.user.id);

  let totalCreated = 0;
  for (const rule of rules) {
    const dates = generateDates(rule, todayStr);
    for (const date of dates) {
      // Avoid duplicates
      const exists = db.prepare(
        'SELECT id FROM transactions WHERE user_id = ? AND recurring_id = ? AND date = ?'
      ).get(req.user.id, rule.id, date);
      if (!exists) {
        db.prepare(
          'INSERT INTO transactions (user_id, date, payee, category, amount, notes, recurring_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(req.user.id, date, rule.payee, rule.category, rule.amount, rule.notes, rule.id);
        totalCreated++;
      }
    }
    if (dates.length > 0) {
      db.prepare('UPDATE recurring_transactions SET last_generated = ? WHERE id = ?').run(todayStr, rule.id);
    }
  }
  res.json({ created: totalCreated });
});

module.exports = router;
