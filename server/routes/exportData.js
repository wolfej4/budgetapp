const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

// Auth middleware that also accepts token as query param
function authFlexible(req, res, next) {
  let token = req.headers.authorization?.split(' ')[1];
  if (!token && req.query.token) token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.use(authFlexible);

router.get('/csv', (req, res) => {
  const type = req.query.type;
  const userId = req.user.id;
  let rows = [];
  let filename = 'export.csv';
  let headers = [];

  if (type === 'bills') {
    rows = db.prepare('SELECT * FROM bills WHERE user_id = ?').all(userId);
    headers = ['id', 'name', 'amount', 'due_day', 'recurrence', 'due_date', 'category', 'notes'];
    filename = 'bills.csv';
  } else if (type === 'transactions') {
    rows = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC').all(userId);
    headers = ['id', 'date', 'payee', 'category', 'amount', 'notes'];
    filename = 'transactions.csv';
  } else if (type === 'loans') {
    rows = db.prepare('SELECT * FROM loans WHERE user_id = ?').all(userId);
    headers = ['id', 'name', 'original_amount', 'current_balance', 'interest_rate', 'monthly_payment', 'start_date', 'category'];
    filename = 'loans.csv';
  } else if (type === 'split-payments') {
    const splits = db.prepare('SELECT * FROM split_payments WHERE user_id = ?').all(userId);
    rows = [];
    for (const sp of splits) {
      const installments = db.prepare('SELECT * FROM split_payment_installments WHERE split_payment_id = ?').all(sp.id);
      for (const inst of installments) {
        rows.push({ provider: sp.provider, description: sp.description, total_amount: sp.total_amount, installment_amount: inst.amount, due_date: inst.due_date, paid: inst.paid ? 'yes' : 'no' });
      }
    }
    headers = ['provider', 'description', 'total_amount', 'installment_amount', 'due_date', 'paid'];
    filename = 'split-payments.csv';
  } else {
    return res.status(400).json({ error: 'type must be bills|transactions|loans|split-payments' });
  }

  const escape = v => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  let csv = headers.join(',') + '\n';
  for (const row of rows) {
    csv += headers.map(h => escape(row[h])).join(',') + '\n';
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(csv);
});

router.get('/pdf', (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const userId = req.user.id;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = monthNames[month - 1];

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  const monthStart = `${monthStr}-01`;

  const bills = db.prepare(`SELECT * FROM bills WHERE user_id = ? AND recurrence='monthly'`).all(userId);
  const loans = db.prepare('SELECT * FROM loans WHERE user_id = ?').all(userId);
  const monthTxs = db.prepare(
    "SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date < ? ORDER BY date ASC"
  ).all(userId, monthStart, monthEnd);
  const installments = db.prepare(`
    SELECT spi.*, sp.description, sp.provider FROM split_payment_installments spi
    JOIN split_payments sp ON spi.split_payment_id = sp.id
    WHERE sp.user_id = ? AND spi.due_date >= ? AND spi.due_date < ?
  `).all(userId, monthStart, monthEnd);

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=report-${year}-${String(month).padStart(2,'0')}.pdf`);
  doc.pipe(res);

  doc.fontSize(20).text(`Monthly Report — ${monthName} ${year}`, { align: 'center' });
  doc.moveDown();

  const fmt = n => '$' + Number(n || 0).toFixed(2);

  const inflows = monthTxs.filter(t => t.amount > 0);
  const outflows = monthTxs.filter(t => t.amount < 0);

  doc.fontSize(14).text('Income (transactions)', { underline: true });
  doc.fontSize(11);
  let incomeTotal = 0;
  for (const t of inflows) {
    doc.text(`  ${t.date}  ${t.payee} (${t.category}): ${fmt(t.amount)}`);
    incomeTotal += t.amount;
  }
  doc.text(`  Total: ${fmt(incomeTotal)}`);
  doc.moveDown();

  doc.fontSize(14).text('Spending (transactions)', { underline: true });
  doc.fontSize(11);
  let spendingTotal = 0;
  for (const t of outflows) {
    doc.text(`  ${t.date}  ${t.payee} (${t.category}): ${fmt(-t.amount)}`);
    spendingTotal += -t.amount;
  }
  doc.text(`  Total: ${fmt(spendingTotal)}`);
  doc.moveDown();

  doc.fontSize(14).text('Bills', { underline: true });
  doc.fontSize(11);
  let billsTotal = 0;
  for (const b of bills) {
    doc.text(`  ${b.name}: ${fmt(b.amount)}`);
    billsTotal += b.amount;
  }
  doc.text(`  Total: ${fmt(billsTotal)}`);
  doc.moveDown();

  doc.fontSize(14).text('Split Payments', { underline: true });
  doc.fontSize(11);
  let splitTotal = 0;
  for (const i of installments) {
    doc.text(`  ${i.description} (${i.provider}) — due ${i.due_date}: ${fmt(i.amount)} ${i.paid ? '[PAID]' : '[UNPAID]'}`);
    splitTotal += i.amount;
  }
  doc.text(`  Total: ${fmt(splitTotal)}`);
  doc.moveDown();

  doc.fontSize(14).text('Loans', { underline: true });
  doc.fontSize(11);
  let loansTotal = 0;
  for (const l of loans) {
    doc.text(`  ${l.name}: ${fmt(l.monthly_payment)}/mo`);
    loansTotal += l.monthly_payment;
  }
  doc.text(`  Total: ${fmt(loansTotal)}`);
  doc.moveDown();

  const committed = billsTotal + splitTotal + loansTotal;
  doc.fontSize(14).text('Summary', { underline: true });
  doc.fontSize(11);
  doc.text(`  Income (transactions):    ${fmt(incomeTotal)}`);
  doc.text(`  Spending (transactions):  ${fmt(spendingTotal)}`);
  doc.text(`  Net cash flow:            ${fmt(incomeTotal - spendingTotal)}`);
  doc.text(`  Committed (bills/splits/loans): ${fmt(committed)}`);

  doc.end();
});

module.exports = router;
