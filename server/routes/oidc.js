const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { getOidcConfig, isConfigured, getClient, getCachedRedirectUri, generators } = require('../oidc');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const TX_COOKIE = 'oidc_tx';

function fallbackRedirectUri(req) {
  return `${req.protocol}://${req.get('host')}/api/auth/oidc/callback`;
}

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function failRedirect(res, message) {
  res.setHeader('Set-Cookie', `${TX_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  res.redirect('/login#oidc_error=' + encodeURIComponent(message));
}

// Public: lets the login page know whether to show the SSO button
router.get('/status', (req, res) => {
  const cfg = getOidcConfig(db);
  res.json({ enabled: isConfigured(db), providerName: cfg.providerName });
});

router.get('/login', async (req, res) => {
  try {
    const client = await getClient(db, fallbackRedirectUri(req));
    if (!client) return failRedirect(res, 'OIDC is not configured');

    const state = generators.state();
    const nonce = generators.nonce();
    const tx = jwt.sign({ state, nonce }, JWT_SECRET, { expiresIn: '10m' });
    res.setHeader('Set-Cookie', `${TX_COOKIE}=${tx}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);

    const url = client.authorizationUrl({ scope: 'openid email profile', state, nonce });
    res.redirect(url);
  } catch (err) {
    console.error('OIDC login error:', err.message);
    failRedirect(res, 'Could not reach the identity provider');
  }
});

router.get('/callback', async (req, res) => {
  try {
    const client = await getClient(db, fallbackRedirectUri(req));
    if (!client) return failRedirect(res, 'OIDC is not configured');

    const txRaw = readCookie(req, TX_COOKIE);
    if (!txRaw) return failRedirect(res, 'Login session expired — please try again');
    let tx;
    try {
      tx = jwt.verify(txRaw, JWT_SECRET);
    } catch {
      return failRedirect(res, 'Login session expired — please try again');
    }

    const params = client.callbackParams(req);
    const redirectUri = getCachedRedirectUri() || fallbackRedirectUri(req);
    const tokenSet = await client.callback(redirectUri, params, { state: tx.state, nonce: tx.nonce });
    const claims = tokenSet.claims();

    const sub = claims.sub;
    const email = claims.email;
    const name = claims.name || claims.preferred_username || (email ? email.split('@')[0] : 'User');
    if (!email) return failRedirect(res, 'Identity provider did not return an email address');

    // Find by OIDC subject, then link by email, then create
    let user = db.prepare('SELECT * FROM users WHERE oidc_sub = ?').get(sub);
    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (user) {
        db.prepare('UPDATE users SET oidc_sub = ? WHERE id = ?').run(sub, user.id);
      } else {
        const setting = db.prepare("SELECT value FROM app_settings WHERE key='registration_open'").get();
        if (setting && setting.value === '0') {
          return failRedirect(res, 'Registration is currently closed');
        }
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
        const role = userCount.count === 0 ? 'admin' : 'user';
        // OIDC-only account: random password so password login can't be guessed
        const randomHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
        const result = db.prepare(
          'INSERT INTO users (name, email, password_hash, role, oidc_sub) VALUES (?, ?, ?, ?, ?)'
        ).run(name, email, randomHash, role, sub);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      }
    }

    if (user.disabled === 1) return failRedirect(res, 'Account disabled');

    const payload = { id: user.id, name: user.name, email: user.email, role: user.role || 'user', disabled: user.disabled || 0 };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

    res.setHeader('Set-Cookie', `${TX_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
    res.redirect('/login#oidc_token=' + encodeURIComponent(token));
  } catch (err) {
    console.error('OIDC callback error:', err.message);
    failRedirect(res, 'Sign-in failed — please try again');
  }
});

module.exports = router;
