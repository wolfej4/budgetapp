const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM category_budgets WHERE user_id = ? ORDER BY category ASC').all(req.user.id);
  res.json(rows);
});

// Upsert a limit for a category; a limit of 0 / null removes it
router.put('/', (req, res) => {
  const { category, monthly_limit } = req.body;
  if (!category) return res.status(400).json({ error: 'category is required' });
  if (!monthly_limit || Number(monthly_limit) <= 0) {
    db.prepare('DELETE FROM category_budgets WHERE user_id = ? AND category = ?').run(req.user.id, category);
    return res.json({ success: true, removed: true });
  }
  db.prepare(
    'INSERT INTO category_budgets (user_id, category, monthly_limit) VALUES (?, ?, ?) ' +
    'ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit'
  ).run(req.user.id, category, Number(monthly_limit));
  res.json(db.prepare('SELECT * FROM category_budgets WHERE user_id = ? AND category = ?').get(req.user.id, category));
});

module.exports = router;
