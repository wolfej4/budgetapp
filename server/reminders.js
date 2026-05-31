const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendReminderForUser(db, user, isTest = false) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('SMTP not configured — skipping reminder email');
    return;
  }

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
    for (const b of upcomingBills) {
      html += `<li>${b.name}: $${b.amount.toFixed(2)}</li>`;
    }
    html += `</ul>`;
  }

  if (upcomingInstallments.length > 0) {
    html += `<h3>Split Payments</h3><ul>`;
    for (const i of upcomingInstallments) {
      html += `<li>${i.description} (${i.provider}): $${i.amount.toFixed(2)}</li>`;
    }
    html += `</ul>`;
  }

  if (!isTest && upcomingBills.length === 0 && upcomingInstallments.length === 0) {
    html += `<p>No upcoming payments found.</p>`;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: `BudgetApp: Upcoming Payment Reminder`,
    html,
  });
}

async function runReminders(db) {
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
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST not set — bill reminders disabled');
    return;
  }
  runReminders(db);
  setInterval(() => runReminders(db), 24 * 60 * 60 * 1000);
}

module.exports = { scheduleReminders, sendReminderForUser };
