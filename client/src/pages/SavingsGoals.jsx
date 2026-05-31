import React, { useEffect, useState } from 'react';
import { get, post, put, del } from '../api.js';

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CATEGORIES = ['general', 'emergency', 'vacation', 'home', 'car', 'education', 'retirement', 'other'];
const emptyForm = { name: '', target_amount: '', current_amount: '', target_date: '', category: 'general', notes: '' };

export default function SavingsGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [contributeGoal, setContributeGoal] = useState(null);
  const [contributeAmount, setContributeAmount] = useState('');

  useEffect(() => { fetchGoals(); }, []);

  async function fetchGoals() {
    const data = await get('/savings-goals');
    setGoals(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(goal) {
    setEditing(goal);
    setForm({
      name: goal.name,
      target_amount: goal.target_amount,
      current_amount: goal.current_amount,
      target_date: goal.target_date || '',
      category: goal.category,
      notes: goal.notes || ''
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount || 0),
      target_date: form.target_date || null
    };
    if (editing) {
      await put(`/savings-goals/${editing.id}`, payload);
    } else {
      await post('/savings-goals', payload);
    }
    setShowModal(false);
    fetchGoals();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this savings goal?')) return;
    await del(`/savings-goals/${id}`);
    fetchGoals();
  }

  async function handleContribute(e) {
    e.preventDefault();
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) return;
    await put(`/savings-goals/${contributeGoal.id}/contribute`, { amount });
    setContributeGoal(null);
    setContributeAmount('');
    fetchGoals();
  }

  function daysRemaining(targetDate) {
    if (!targetDate) return null;
    const diff = new Date(targetDate) - new Date();
    return Math.ceil(diff / 86400000);
  }

  function projectedCompletion(goal) {
    if (goal.target_date) return null; // already has a date
    const pct = goal.current_amount / goal.target_amount;
    if (pct <= 0) return 'No contributions yet';
    if (pct >= 1) return 'Complete!';
    return `${Math.round(pct * 100)}% complete`;
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">Savings Goals</div>
        <button className="btn btn-primary" onClick={openAdd}>+ New Goal</button>
      </div>

      {goals.length > 0 && (
        <div className="card-grid" style={{ marginBottom: 24 }}>
          <div className="summary-card">
            <div className="card-label">Total Saved</div>
            <div className="card-value">{fmt(totalSaved)}</div>
            <div className="card-sub">{goals.length} active goals</div>
          </div>
          <div className="summary-card">
            <div className="card-label">Total Target</div>
            <div className="card-value">{fmt(totalTarget)}</div>
            <div className="card-sub">{fmt(totalTarget - totalSaved)} remaining</div>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <div className="empty-state-text">No savings goals yet. Start saving for something!</div>
            <button className="btn btn-primary" onClick={openAdd}>Create Goal</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {goals.map(goal => {
            const pct = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
            const days = daysRemaining(goal.target_date);
            const proj = projectedCompletion(goal);
            return (
              <div className="card" key={goal.id}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{goal.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{goal.category}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => { setContributeGoal(goal); setContributeAmount(''); }}>+ Contribute</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(goal)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(goal.id)}>Delete</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                  <span>{fmt(goal.current_amount)} saved</span>
                  <span style={{ color: 'var(--text-muted)' }}>Goal: {fmt(goal.target_amount)}</span>
                </div>

                <div className="progress-bar" style={{ height: 10, marginBottom: 12 }}>
                  <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : 'var(--accent)' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>{pct.toFixed(1)}% complete</span>
                  {goal.target_date && days !== null ? (
                    <span style={{ color: days < 0 ? 'var(--danger)' : days <= 30 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today!' : `${days} days remaining (${goal.target_date})`}
                    </span>
                  ) : proj ? (
                    <span>{proj}</span>
                  ) : null}
                </div>

                {goal.notes && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{goal.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editing ? 'Edit Goal' : 'New Savings Goal'}</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Goal Name</label>
                <input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Emergency Fund" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Target Amount ($)</label>
                  <input className="form-input" type="number" step="0.01" required value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Current Amount ($)</label>
                  <input className="form-input" type="number" step="0.01" value={form.current_amount} onChange={e => setForm({ ...form, current_amount: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Target Date (optional)</label>
                  <input className="form-input" type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Create Goal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {contributeGoal && (
        <div className="modal-overlay" onClick={() => setContributeGoal(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Contribution</div>
            <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: 14 }}>
              Adding to: <strong style={{ color: 'var(--text)' }}>{contributeGoal.name}</strong><br />
              Current: {fmt(contributeGoal.current_amount)} / {fmt(contributeGoal.target_amount)}
            </div>
            <form onSubmit={handleContribute}>
              <div className="form-group">
                <label className="form-label">Amount ($)</label>
                <input className="form-input" type="number" step="0.01" required autoFocus value={contributeAmount} onChange={e => setContributeAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setContributeGoal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Contribution</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
