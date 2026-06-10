const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

function amortize(balance, rate, payment, extraPayment = 0) {
  const monthlyRate = rate / 12 / 100;
  const schedule = [];
  let month = 0;
  let bal = balance;
  const totalPayment = payment + extraPayment;

  while (bal > 0 && month < 600) {
    month++;
    const interest = bal * monthlyRate;
    let principal = totalPayment - interest;
    if (principal <= 0) {
      // Payment doesn't cover interest
      schedule.push({ month, balance: bal, principal: 0, interest });
      continue;
    }
    if (principal > bal) principal = bal;
    bal = bal - principal;
    if (bal < 0.01) bal = 0;
    schedule.push({ month, balance: parseFloat(bal.toFixed(2)), principal: parseFloat(principal.toFixed(2)), interest: parseFloat(interest.toFixed(2)) });
    if (bal === 0) break;
  }
  return schedule;
}

router.get('/', (req, res) => {
  const loans = db.prepare('SELECT * FROM loans WHERE user_id = ? ORDER BY id ASC').all(req.user.id);
  res.json(loans);
});

router.post('/', (req, res) => {
  const { name, original_amount, current_balance, interest_rate, monthly_payment, start_date, category, budget_id, due_day } = req.body;
  if (!name || original_amount == null || current_balance == null || interest_rate == null || monthly_payment == null || !start_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const result = db.prepare(
    'INSERT INTO loans (user_id, budget_id, name, original_amount, current_balance, interest_rate, monthly_payment, start_date, category, due_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, budget_id || null, name, original_amount, current_balance, interest_rate, monthly_payment, start_date, category || 'auto', due_day || null);
  res.json(db.prepare('SELECT * FROM loans WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  const { name, original_amount, current_balance, interest_rate, monthly_payment, start_date, category, budget_id, due_day } = req.body;
  db.prepare(
    'UPDATE loans SET name=?, original_amount=?, current_balance=?, interest_rate=?, monthly_payment=?, start_date=?, category=?, budget_id=?, due_day=? WHERE id=?'
  ).run(
    name ?? loan.name,
    original_amount ?? loan.original_amount,
    current_balance ?? loan.current_balance,
    interest_rate ?? loan.interest_rate,
    monthly_payment ?? loan.monthly_payment,
    start_date ?? loan.start_date,
    category ?? loan.category,
    budget_id ?? loan.budget_id,
    due_day !== undefined ? due_day : loan.due_day,
    loan.id
  );
  res.json(db.prepare('SELECT * FROM loans WHERE id = ?').get(loan.id));
});

router.delete('/:id', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  db.prepare('DELETE FROM loans WHERE id = ?').run(loan.id);
  res.json({ success: true });
});

router.get('/:id/amortization', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  const schedule = amortize(loan.current_balance, loan.interest_rate, loan.monthly_payment);
  res.json(schedule);
});

router.get('/:id/simulate', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  const extra = parseFloat(req.query.extraPayment) || 0;
  const base = amortize(loan.current_balance, loan.interest_rate, loan.monthly_payment);
  const accelerated = amortize(loan.current_balance, loan.interest_rate, loan.monthly_payment, extra);
  res.json({ base, accelerated, monthsSaved: base.length - accelerated.length });
});

module.exports = router;
