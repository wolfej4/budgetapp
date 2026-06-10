const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { sendReminderForUser, sendWeeklyDigestForUser } = require('../reminders');

router.use(auth);

router.get('/smtp-status', (req, res) => {
  const dbHost = db.prepare("SELECT value FROM app_settings WHERE key='smtp_host'").get();
  const configured = !!(process.env.SMTP_HOST || (dbHost && dbHost.value));
  res.json({ configured });
});

router.post('/test-reminder', async (req, res) => {
  try {
    // Use the real user ID (not impersonated) for test emails
    const userId = req.user.originalId || req.user.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found — try logging out and back in' });
    await sendReminderForUser(db, user, true);
    res.json({ success: true, message: 'Test reminder sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test-digest', async (req, res) => {
  try {
    const userId = req.user.originalId || req.user.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found — try logging out and back in' });
    await sendWeeklyDigestForUser(db, user, true);
    res.json({ success: true, message: 'Test digest sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
