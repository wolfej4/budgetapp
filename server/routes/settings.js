const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { sendReminderForUser } = require('../reminders');

router.use(auth);

router.get('/smtp-status', (req, res) => {
  res.json({ configured: !!(process.env.SMTP_HOST) });
});

router.post('/test-reminder', async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await sendReminderForUser(db, user, true);
    res.json({ success: true, message: 'Test reminder sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
