const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', (req, res) => {
  const plans = db.prepare('SELECT * FROM split_payments WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const result = plans.map(plan => {
    const installments = db.prepare('SELECT * FROM split_payment_installments WHERE split_payment_id = ? ORDER BY due_date ASC').all(plan.id);
    return { ...plan, installments };
  });
  res.json(result);
});

router.post('/', (req, res) => {
  const { provider, description, total_amount, installments, budget_id } = req.body;
  if (!provider || !description || total_amount == null || !Array.isArray(installments) || installments.length === 0) {
    return res.status(400).json({ error: 'provider, description, total_amount, and installments are required' });
  }
  const planResult = db.prepare(
    'INSERT INTO split_payments (user_id, budget_id, provider, description, total_amount) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, budget_id || null, provider, description, total_amount);
  const planId = planResult.lastInsertRowid;

  const insertInst = db.prepare('INSERT INTO split_payment_installments (split_payment_id, amount, due_date) VALUES (?, ?, ?)');
  for (const inst of installments) {
    insertInst.run(planId, inst.amount, inst.due_date);
  }

  const plan = db.prepare('SELECT * FROM split_payments WHERE id = ?').get(planId);
  const instRows = db.prepare('SELECT * FROM split_payment_installments WHERE split_payment_id = ? ORDER BY due_date ASC').all(planId);
  res.json({ ...plan, installments: instRows });
});

router.put('/:id/installments/:instId', (req, res) => {
  const plan = db.prepare('SELECT * FROM split_payments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const inst = db.prepare('SELECT * FROM split_payment_installments WHERE id = ? AND split_payment_id = ?').get(req.params.instId, plan.id);
  if (!inst) return res.status(404).json({ error: 'Installment not found' });
  const { paid } = req.body;
  db.prepare('UPDATE split_payment_installments SET paid = ? WHERE id = ?').run(paid ? 1 : 0, inst.id);
  res.json(db.prepare('SELECT * FROM split_payment_installments WHERE id = ?').get(inst.id));
});

router.delete('/:id', (req, res) => {
  const plan = db.prepare('SELECT * FROM split_payments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  db.prepare('DELETE FROM split_payments WHERE id = ?').run(plan.id);
  res.json({ success: true });
});

module.exports = router;
