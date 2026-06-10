const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

function getMonthData(userId, year, month) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  const monthStart = `${monthStr}-01`;

  // Bills for this month
  const allBills = db.prepare('SELECT * FROM bills WHERE user_id = ?').all(userId);
  const billsThisMonth = allBills.filter(b => {
    if (b.recurrence === 'monthly') return true;
    if (b.recurrence === 'yearly' && b.due_date) {
      const d = new Date(b.due_date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }
    if (b.recurrence === 'one-time' && b.due_date) {
      return b.due_date >= monthStart && b.due_date < monthEnd;
    }
    return false;
  });
  const billsByCategory = {};
  let billsTotal = 0;
  for (const b of billsThisMonth) {
    const cat = b.category || 'other';
    billsByCategory[cat] = (billsByCategory[cat] || 0) + b.amount;
    billsTotal += b.amount;
  }

  // Split payments installments due this month
  const installments = db.prepare(`
    SELECT spi.*, sp.user_id FROM split_payment_installments spi
    JOIN split_payments sp ON spi.split_payment_id = sp.id
    WHERE sp.user_id = ? AND spi.due_date >= ? AND spi.due_date < ?
  `).all(userId, monthStart, monthEnd);
  const splitTotal = installments.reduce((s, i) => s + i.amount, 0);
  const splitDue = installments.filter(i => !i.paid).reduce((s, i) => s + i.amount, 0);
  const splitPaid = installments.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);

  // Loans monthly payments
  const loans = db.prepare('SELECT * FROM loans WHERE user_id = ?').all(userId);
  const loansTotal = loans.reduce((s, l) => s + l.monthly_payment, 0);
  const loansByName = {};
  for (const l of loans) loansByName[l.name] = l.monthly_payment;

  // Income: positive transactions from the ledger for this month
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const inflows = db.prepare(
    "SELECT * FROM transactions WHERE user_id = ? AND amount > 0 AND date LIKE ? || '%'"
  ).all(userId, prefix);
  const incomeTotal = inflows.reduce((s, t) => s + t.amount, 0);
  const incomeByCategory = {};
  for (const t of inflows) {
    const cat = t.category || 'Other';
    incomeByCategory[cat] = (incomeByCategory[cat] || 0) + t.amount;
  }

  const totalExpenses = billsTotal + splitTotal + loansTotal;
  const net = incomeTotal - totalExpenses;

  return {
    bills: { total: billsTotal, byCategory: billsByCategory },
    splitPayments: { total: splitTotal, due: splitDue, paid: splitPaid },
    loans: { total: loansTotal, byName: loansByName },
    income: { total: incomeTotal, byCategory: incomeByCategory },
    net
  };
}

router.get('/monthly', (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;

  const current = getMonthData(req.user.id, year, month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const previousMonth = getMonthData(req.user.id, prevYear, prevMonth);

  res.json({ ...current, previousMonth });
});

module.exports = router;
