const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(req.user.id);
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

router.put('/', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  db.prepare(
    'INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ' +
    'ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value'
  ).run(req.user.id, key, String(value));
  res.json({ success: true });
});

module.exports = router;
