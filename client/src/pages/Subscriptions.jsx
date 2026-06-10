import React, { useEffect, useState } from 'react';
import { get, post, put, del } from '../api.js';

const CATEGORIES = ['Streaming', 'Music', 'Software', 'Gaming', 'Fitness', 'Cloud Storage', 'News', 'Other'];

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EMPTY_FORM = {
  name: '', amount: '', billing_cycle: 'monthly', due_day: '', renewal_date: '', category: 'Streaming', notes: ''
};

export default function Subscriptions() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSub, setEditSub] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    get('/subscriptions').then(data => {
      setSubs(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const active = subs.filter(s => s.active);
  const monthlyCost = active.reduce((sum, s) =>
    sum + (s.billing_cycle === 'yearly' ? s.amount / 12 : s.amount), 0);
  const yearlyCost = active.reduce((sum, s) =>
    sum + (s.billing_cycle === 'yearly' ? s.amount : s.amount * 12), 0);

  const openAdd = () => {
    setEditSub(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (sub) => {
    setEditSub(sub);
    setForm({
      name: sub.name,
      amount: String(sub.amount),
      billing_cycle: sub.billing_cycle || 'monthly',
      due_day: sub.due_day ? String(sub.due_day) : '',
      renewal_date: sub.renewal_date || '',
      category: sub.category || 'Other',
      notes: sub.notes || ''
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      name: form.name,
      amount: parseFloat(form.amount),
      billing_cycle: form.billing_cycle,
      due_day: form.billing_cycle === 'monthly' ? (parseInt(form.due_day, 10) || null) : null,
      renewal_date: form.billing_cycle === 'yearly' ? (form.renewal_date || null) : null,
      category: form.category,
      notes: form.notes || null
    };
    try {
      const data = editSub
        ? await put(`/subscriptions/${editSub.id}`, payload)
        : await post('/subscriptions', payload);
      if (data.error) { setError(data.error); return; }
      setShowModal(false);
      load();
    } catch {
      setError('Failed to save subscription.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (sub) => {
    await put(`/subscriptions/${sub.id}`, { active: sub.active ? 0 : 1 });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subscription?')) return;
    await del(`/subscriptions/${id}`);
    load();
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Subscriptions</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Subscription</button>
      </div>

      <div className="card-grid">
        <div className="summary-card">
          <div className="card-label">Monthly Cost</div>
          <div className="card-value">{fmt(monthlyCost)}</div>
          <div className="card-sub">{active.length} active subscription{active.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Yearly Cost</div>
          <div className="card-value">{fmt(yearlyCost)}</div>
          <div className="card-sub">If all stay active</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Paused</div>
          <div className="card-value">{subs.length - active.length}</div>
          <div className="card-sub">Not counted in totals</div>
        </div>
      </div>

      {subs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-text">No subscriptions yet. Add your first one!</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Cycle</th>
                  <th>Renews</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(sub => (
                  <tr key={sub.id} style={sub.active ? {} : { opacity: 0.55 }}>
                    <td style={{ fontWeight: 600 }}>{sub.name}</td>
                    <td>{sub.category || '—'}</td>
                    <td>{fmt(sub.amount)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{sub.billing_cycle}</td>
                    <td>
                      {sub.billing_cycle === 'monthly' ? `Day ${sub.due_day}` : (sub.renewal_date || '—')}
                    </td>
                    <td>
                      <span className={`badge ${sub.active ? 'badge-active' : 'badge-disabled'}`}>
                        {sub.active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td>
                      <div className="flex-gap">
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(sub)}>
                          {sub.active ? 'Pause' : 'Resume'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(sub)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(sub.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editSub ? 'Edit Subscription' : 'Add Subscription'}</div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Netflix" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Billing Cycle</label>
                  <select className="form-select" value={form.billing_cycle} onChange={e => setForm({...form, billing_cycle: e.target.value})}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                {form.billing_cycle === 'monthly' ? (
                  <div className="form-group">
                    <label className="form-label">Due Day (1-31)</label>
                    <input className="form-input" type="number" min="1" max="31" required value={form.due_day} onChange={e => setForm({...form, due_day: e.target.value})} placeholder="15" />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Renewal Date</label>
                    <input className="form-input" type="date" required value={form.renewal_date} onChange={e => setForm({...form, renewal_date: e.target.value})} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional notes..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editSub ? 'Update' : 'Add Subscription')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
