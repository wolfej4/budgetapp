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
    subject: `BudgetApp: Upcoming Payment Reminder`,
    html,
  });
}

async function runReminders(db) {
  const cfg = getSmtpConfig(db);
  if (!cfg.host) return; // silently skip if still not configured
  const users = db.prepare('SELECT * FROM users').all();
  for (const user of users) {
    try {
      await sendReminderForUser(db, user);
    } catch (err) {
      console.error(`Failed to send reminder to ${user.email}:`, err.message);
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

module.exports = { scheduleReminders, sendReminderForUser };
