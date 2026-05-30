const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', (req, res) => {
  const budgets = db.prepare(`
    SELECT b.*, bm.role FROM budgets b
    JOIN budget_members bm ON bm.budget_id = b.id
    WHERE bm.user_id = ?
    ORDER BY b.created_at DESC
  `).all(req.user.id);

  const result = budgets.map(budget => {
    const members = db.prepare(`
      SELECT u.id, u.name, u.email, bm.role FROM budget_members bm
      JOIN users u ON u.id = bm.user_id
      WHERE bm.budget_id = ?
    `).all(budget.id);
    return { ...budget, members };
  });
  res.json(result);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare('INSERT INTO budgets (name, owner_id) VALUES (?, ?)').run(name, req.user.id);
  db.prepare('INSERT INTO budget_members (budget_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, req.user.id, 'owner');
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(result.lastInsertRowid);
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, bm.role FROM budget_members bm
    JOIN users u ON u.id = bm.user_id
    WHERE bm.budget_id = ?
  `).all(budget.id);
  res.json({ ...budget, members });
});

router.post('/:id/invite', (req, res) => {
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
  if (!budget) return res.status(404).json({ error: 'Budget not found' });

  const myMembership = db.prepare('SELECT role FROM budget_members WHERE budget_id = ? AND user_id = ?').get(budget.id, req.user.id);
  if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'editor')) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const { email, role } = req.body;
  const invitee = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!invitee) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare('SELECT * FROM budget_members WHERE budget_id = ? AND user_id = ?').get(budget.id, invitee.id);
  if (existing) {
    db.prepare('UPDATE budget_members SET role = ? WHERE budget_id = ? AND user_id = ?').run(role || 'viewer', budget.id, invitee.id);
  } else {
    db.prepare('INSERT INTO budget_members (budget_id, user_id, role) VALUES (?, ?, ?)').run(budget.id, invitee.id, role || 'viewer');
  }
  res.json({ success: true });
});

router.delete('/:id/members/:userId', (req, res) => {
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
  if (!budget) return res.status(404).json({ error: 'Budget not found' });

  const myMembership = db.prepare('SELECT role FROM budget_members WHERE budget_id = ? AND user_id = ?').get(budget.id, req.user.id);
  if (!myMembership || myMembership.role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can remove members' });
  }

  if (parseInt(req.params.userId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot remove yourself as owner' });
  }

  db.prepare('DELETE FROM budget_members WHERE budget_id = ? AND user_id = ?').run(budget.id, req.params.userId);
  res.json({ success: true });
});

module.exports = router;
