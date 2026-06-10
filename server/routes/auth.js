const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

router.post('/register', (req, res) => {
  const { name, email, password, invite_token } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  // Check if registration is open or a valid invite token is provided
  const setting = db.prepare("SELECT value FROM app_settings WHERE key='registration_open'").get();
  const registrationOpen = !setting || setting.value !== '0';

  let invite = null;
  if (invite_token) {
    invite = db.prepare('SELECT * FROM invites WHERE token = ?').get(invite_token);
    if (!invite) return res.status(400).json({ error: 'Invalid invite link.' });
    if (invite.used_at) return res.status(400).json({ error: 'This invite link has already been used.' });
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This invite link has expired.' });
    }
  } else if (!registrationOpen) {
    return res.status(403).json({ error: 'Registration is currently closed. You need an invite link to sign up.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  // First user gets admin role
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const role = userCount.count === 0 ? 'admin' : 'user';

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, password_hash, role);
  if (invite) {
    db.prepare('UPDATE invites SET used_at = CURRENT_TIMESTAMP, used_by = ? WHERE id = ?').run(result.lastInsertRowid, invite.id);
  }
  const user = { id: result.lastInsertRowid, name, email, role };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.disabled === 1) {
    return res.status(403).json({ error: 'Account disabled' });
  }
  const payload = { id: user.id, name: user.name, email: user.email, role: user.role || 'user', disabled: user.disabled || 0 };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: payload });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
