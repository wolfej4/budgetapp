import React, { useEffect, useState } from 'react';
import { get, post, put, del } from '../api.js';

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PROVIDERS = ['Zip', 'Klarna', 'Affirm', 'Other'];
const PROVIDER_BADGE = { Zip: 'badge-zip', Klarna: 'badge-klarna', Affirm: 'badge-affirm', Other: 'badge-other' };

const EMPTY_FORM = { provider: 'Zip', description: '', total_amount: '' };
const EMPTY_INST = { amount: '', due_date: '' };

function groupByProvider(plans) {
  const groups = {};
  plans.forEach(p => {
    if (!groups[p.provider]) groups[p.provider] = [];
    groups[p.provider].push(p);
  });
  return groups;
}

export default function SplitPayments() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [installments, setInstallments] = useState([{ ...EMPTY_INST }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    get('/split-payments').then(data => {
      setPlans(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleMarkPaid = async (planId, instId, paid) => {
    await put(`/split-payments/${planId}/installments/${instId}`, { paid });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this split payment plan?')) return;
    await del(`/split-payments/${id}`);
    load();
  };

  const addInstallmentRow = () => setInstallments([...installments, { ...EMPTY_INST }]);
  const removeInstallmentRow = (i) => setInstallments(installments.filter((_, idx) => idx !== i));
  const updateInst = (i, field, value) => {
    const updated = [...installments];
    updated[i] = { ...updated[i], [field]: value };
    setInstallments(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validInsts = installments.filter(i => i.amount && i.due_date);
    if (validInsts.length === 0) {
      setError('Add at least one installment with amount and date.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        provider: form.provider,
        description: form.description,
        total_amount: parseFloat(form.total_amount),
        installments: validInsts.map(i => ({ amount: parseFloat(i.amount), due_date: i.due_date }))
      };
      const data = await post('/split-payments', payload);
      if (data.error) { setError(data.error); return; }
      setShowModal(false);
      setForm(EMPTY_FORM);
      setInstallments([{ ...EMPTY_INST }]);
      load();
    } catch {
      setError('Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  const groups = groupByProvider(plans);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Split Payments</div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setInstallments([{ ...EMPTY_INST }]); setError(''); setShowModal(true); }}>
          + Add Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <div className="empty-state-text">No split payment plans yet. Add your first plan!</div>
          </div>
        </div>
      ) : (
        Object.entries(groups).map(([provider, providerPlans]) => (
          <div className="section" key={provider}>
            <div className="section-header">
              <div className="section-title flex-gap">
                <span className={`badge ${PROVIDER_BADGE[provider] || 'badge-other'}`}>{provider}</span>
                <span>{providerPlans.length} plan{providerPlans.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            {providerPlans.map(plan => {
              const totalPaid = (plan.installments || []).filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
              const totalUnpaid = (plan.installments || []).filter(i => !i.paid).reduce((s, i) => s + i.amount, 0);
              const pct = plan.total_amount > 0 ? Math.round((totalPaid / plan.total_amount) * 100) : 0;
              return (
                <div className="plan-card" key={plan.id}>
                  <div className="plan-header">
                    <span className={`badge ${PROVIDER_BADGE[plan.provider] || 'badge-other'}`}>{plan.provider}</span>
                    <span className="plan-desc">{plan.description}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(plan.total_amount)}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(plan.id)}>Delete</button>
                  </div>
                  <div className="plan-meta">
                    {fmt(totalPaid)} paid &bull; {fmt(totalUnpaid)} remaining &bull; {pct}% complete
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: pct + '%' }} />
                  </div>
                  <div>
                    {(plan.installments || []).map(inst => (
                      <div className="installment-row" key={inst.id}>
                        <div className={`installment-dot${inst.paid ? ' paid' : ''}`} />
                        <span className="installment-amount">{fmt(inst.amount)}</span>
                        <span className="installment-date">{inst.due_date}</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
                          <input
                            type="checkbox"
                            checked={!!inst.paid}
                            onChange={() => handleMarkPaid(plan.id, inst.id, !inst.paid)}
                            style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                          />
                          {inst.paid ? 'Paid' : 'Mark paid'}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Split Payment Plan</div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Provider</label>
                  <select className="form-select" value={form.provider} onChange={e => setForm({...form, provider: e.target.value})}>
                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Total Amount ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0" required value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})} placeholder="0.00" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" required value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="e.g. iPhone 15 Pro" />
              </div>

              <div className="form-group">
                <div className="flex-between mb-8">
                  <label className="form-label" style={{ marginBottom: 0 }}>Installments</label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addInstallmentRow}>+ Add Row</button>
                </div>
                {installments.map((inst, i) => (
                  <div key={i} className="flex-gap" style={{ marginBottom: 8 }}>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Amount"
                      value={inst.amount}
                      onChange={e => updateInst(i, 'amount', e.target.value)}
                      style={{ width: 120 }}
                    />
                    <input
                      className="form-input"
                      type="date"
                      value={inst.due_date}
                      onChange={e => updateInst(i, 'due_date', e.target.value)}
                    />
                    {installments.length > 1 && (
                      <button type="button" className="btn-icon" onClick={() => removeInstallmentRow(i)} title="Remove">✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Plan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
