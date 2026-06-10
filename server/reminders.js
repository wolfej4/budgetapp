const nodemailer = require('nodemailer');

function getSmtpConfig(db) {
  const rows = db.prepare('SELECT key, value FROM app_settings WHERE key LIKE ?').all('smtp_%');
  const dbCfg = {};
  for (const row of rows) dbCfg[row.key] = row.value;

  // Env vars take precedence over DB settings
  return {
    host:  process.env.SMTP_HOST || dbCfg.smtp_host || '',
    port:  parseInt(process.env.SMTP_PORT || dbCfg.smtp_port) || 587,
    user:  process.env.SMTP_USER || dbCfg.smtp_user || '',
    pass:  process.env.SMTP_PASS || dbCfg.smtp_pass || '',
    from:  process.env.SMTP_FROM || dbCfg.smtp_from || '',
  };
}

function getTransporter(db) {
  const cfg = getSmtpConfig(db);
  if (!cfg.host) return null;
  return {
    transporter: nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      auth: { user: cfg.user, pass: cfg.pass },
    }),
    from: cfg.from || cfg.user,
  };
}

async function sendReminderForUser(db, user, isTest = false) {
  const result = getTransporter(db);
  if (!result) {
    console.warn('SMTP not configured — skipping reminder email');
    return;
  }
  const { transporter, from } = result;

  const today = new Date();
  const targetDate = new Date(today.getTime() + 3 * 86400000);
  const targetStr = targetDate.toISOString().slice(0, 10);
  const targetDay = targetDate.getDate();

  const upcomingBills = db.prepare(
    `SELECT * FROM bills WHERE user_id = ? AND (
      (recurrence = 'monthly' AND due_day = ?) OR
      (recurrence != 'monthly' AND due_date = ?)
    )`
  ).all(user.id, targetDay, targetStr);

  const upcomingInstallments = db.prepare(`
    SELECT spi.*, sp.description, sp.provider FROM split_payment_installments spi
    JOIN split_payments sp ON spi.split_payment_id = sp.id
    WHERE sp.user_id = ? AND spi.due_date = ? AND spi.paid = 0
  `).all(user.id, targetStr);

  if (!isTest && upcomingBills.length === 0 && upcomingInstallments.length === 0) return;

  let html = `<h2>Upcoming Payments Reminder</h2>`;
  if (isTest) html += `<p><em>This is a test reminder.</em></p>`;
  html += `<p>The following payments are due in 3 days (${targetStr}):</p>`;

  if (upcomingBills.length > 0) {
    html += `<h3>Bills</h3><ul>`;
    for (const b of upcomingBills) html += `<li>${b.name}: $${b.amount.toFixed(2)}</li>`;
    html += `</ul>`;
  }

  if (upcomingInstallments.length > 0) {
    html += `<h3>Split Payments</h3><ul>`;
    for (const i of upcomingInstallments) {
      html += `<li>${i.description} (${i.provider}): $${i.amount.toFixed(2)}</li>`;
    }
    html += `</ul>`;
  }

  if (isTest && upcomingBills.length === 0 && upcomingInstallments.length === 0) {
    html += `<p>No upcoming payments found.</p>`;
  }

  await transporter.sendMail({
    from,
    to: user.email,
    subject: `BudgetBuddy: Upcoming Payment Reminder`,
    html,
  });
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function sendWeeklyDigestForUser(db, user, isTest = false) {
  const result = getTransporter(db);
  if (!result) {
    console.warn('SMTP not configured — skipping weekly digest');
    return;
  }
  const { transporter, from } = result;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

  const txs = db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC'
  ).all(user.id, dateStr(weekAgo), dateStr(now));

  const spent = txs.filter(t => t.amount < 0);
  const totalSpent = spent.reduce((s, t) => s - t.amount, 0);
  const totalIn = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const byCategory = {};
  const byPayee = {};
  for (const t of spent) {
    byCategory[t.category || 'Other'] = (byCategory[t.category || 'Other'] || 0) - t.amount;
    byPayee[t.payee] = (byPayee[t.payee] || 0) - t.amount;
  }
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topPayees = Object.entries(byPayee).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const dueInstallments = db.prepare(`
    SELECT spi.*, sp.description, sp.provider FROM split_payment_installments spi
    JOIN split_payments sp ON spi.split_payment_id = sp.id
    WHERE sp.user_id = ? AND spi.paid = 0 AND spi.due_date >= ? AND spi.due_date <= ?
    ORDER BY spi.due_date ASC
  `).all(user.id, dateStr(now), dateStr(weekAhead));
  const installmentTotal = dueInstallments.reduce((s, i) => s + i.amount, 0);

  const money = n => '$' + Number(n).toFixed(2);

  let html = `<h2>Your Weekly Spending Digest</h2>`;
  if (isTest) html += `<p><em>This is a test digest.</em></p>`;
  html += `<p>Past 7 days: <strong>${money(totalSpent)}</strong> spent across ${spent.length} transaction${spent.length !== 1 ? 's' : ''}, ${money(totalIn)} received.</p>`;

  if (topCategories.length > 0) {
    html += `<h3>Top Categories</h3><ul>`;
    for (const [cat, amt] of topCategories) html += `<li>${cat}: ${money(amt)}</li>`;
    html += `</ul>`;
  }
  if (topPayees.length > 0) {
    html += `<h3>Top Payees</h3><ul>`;
    for (const [payee, amt] of topPayees) html += `<li>${payee}: ${money(amt)}</li>`;
    html += `</ul>`;
  }
  if (dueInstallments.length > 0) {
    html += `<h3>Split Payments Due This Week (${money(installmentTotal)})</h3><ul>`;
    for (const i of dueInstallments) html += `<li>${i.due_date} — ${i.description} (${i.provider}): ${money(i.amount)}</li>`;
    html += `</ul>`;
  }
  if (spent.length === 0 && dueInstallments.length === 0) {
    html += `<p>No spending logged and nothing due this week. Nice and quiet.</p>`;
  }

  await transporter.sendMail({
    from,
    to: user.email,
    subject: `BudgetBuddy: Weekly Spending Digest`,
    html,
  });
}

function getUserSetting(db, userId, key) {
  const row = db.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').get(userId, key);
  return row ? row.value : null;
}

function setUserSetting(db, userId, key, value) {
  db.prepare(
    'INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ' +
    'ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value'
  ).run(userId, key, String(value));
}

async function runReminders(db) {
  const cfg = getSmtpConfig(db);
  if (!cfg.host) return; // silently skip if still not configured
  const users = db.prepare('SELECT * FROM users').all();
  const today = new Date();
  const isSunday = today.getDay() === 0;
  const todayStr = dateStr(today);

  for (const user of users) {
    try {
      await sendReminderForUser(db, user);
    } catch (err) {
      console.error(`Failed to send reminder to ${user.email}:`, err.message);
    }

    // Weekly digest on Sundays (opt-out via user_settings, dedupe via last-sent date)
    if (isSunday) {
      try {
        const enabled = getUserSetting(db, user.id, 'weekly_digest') !== '0';
        const lastSent = getUserSetting(db, user.id, 'digest_last_sent');
        if (enabled && lastSent !== todayStr) {
          await sendWeeklyDigestForUser(db, user);
          setUserSetting(db, user.id, 'digest_last_sent', todayStr);
        }
      } catch (err) {
        console.error(`Failed to send digest to ${user.email}:`, err.message);
      }
    }
  }
}

function scheduleReminders(db) {
  const cfg = getSmtpConfig(db);
  if (!cfg.host) {
    console.warn('SMTP not configured — bill reminders will activate once SMTP is set in Admin → Settings');
  }
  // Always schedule — config may be added via admin UI after startup
  runReminders(db);
  setInterval(() => runReminders(db), 24 * 60 * 60 * 1000);
}

module.exports = { scheduleReminders, sendReminderForUser, sendWeeklyDigestForUser };
