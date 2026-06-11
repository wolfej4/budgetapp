import React, { useEffect, useState } from 'react';
import { get, post, put, del } from '../api.js';

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PROVIDERS = ['Zip', 'Klarna', 'Affirm', 'Afterpay', 'Other'];
const PROVIDER_BADGE = { Zip: 'badge-zip', Klarna: 'badge-klarna', Affirm: 'badge-affirm', Afterpay: 'badge-afterpay', Other: 'badge-other' };

const EMPTY_FORM = { provider: 'Zip', description: '', marketplace: '', total_amount: '' };
const EMPTY_INST = { amount: '', due_date: '' };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [installments, setInstallments] = useState([{ ...EMPTY_INST }]);
  const [autoSplit, setAutoSplit] = useState({ count: '4', frequency: 'biweekly', firstDate: todayStr() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState(() => localStorage.getItem('splitPaymentsView') || 'list');
  const [weeklyLimit, setWeeklyLimit] = useState(0);
  const [limitInput, setLimitInput] = useState('');

  // Pay confirmation modal
  const [payModal, setPayModal] = useState(null); // { planId, instId, amount, payee, date }
  const [payDate, setPayDate] = useState(todayStr());
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const switchView = (v) => {
    setView(v);
    localStorage.setItem('splitPaymentsView', v);
  };

  useEffect(() => {
    get('/user-settings').then(s => {
      const lim = parseFloat(s.bnpl_weekly_limit) || 0;
      setWeeklyLimit(lim);
      setLimitInput(lim ? String(lim) : '');
    });
  }, []);

  const saveLimit = async () => {
    const val = parseFloat(limitInput) || 0;
    await put('/user-settings', { key: 'bnpl_weekly_limit', value: String(val) });
    setWeeklyLimit(val);
  };

  // Bucket unpaid installments into 8 weekly windows starting today.
  // extraRows (from the plan form) and excludePlanId (when editing) let the
  // modal preview what a new/edited plan does to the load.
  const weeklyBuckets = (planList, extraRows = [], excludePlanId = null) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const buckets = Array.from({ length: 8 }, (_, i) => ({
      from: new Date(start.getTime() + i * 7 * 86400000),
      to: new Date(start.getTime() + (i * 7 + 6) * 86400000),
      total: 0,
    }));
    const add = (dueDate, amount) => {
      const d = new Date(dueDate + 'T00:00:00');
      const diff = Math.floor((d - start) / 86400000);
      if (diff >= 0 && diff < 56) buckets[Math.floor(diff / 7)].total += amount;
    };
    planList.forEach(sp => {
      if (sp.id === excludePlanId) return;
      (sp.installments || []).forEach(inst => { if (!inst.paid) add(inst.due_date, inst.amount); });
    });
    extraRows.forEach(r => {
      if (r.due_date && r.amount && !r.paid) add(r.due_date, parseFloat(r.amount) || 0);
    });
    return buckets;
  };

  const fmtRange = (b) => {
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${M[b.from.getMonth()]} ${b.from.getDate()} – ${M[b.to.getMonth()]} ${b.to.getDate()}`;
  };

  const load = () => {
    get('/split-payments').then(data => {
      setPlans(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const openPayModal = (planId, instId, amount, payee) => {
    setPayModal({ planId, instId, amount, payee });
    setPayDate(todayStr());
    setPayNotes('');
  };

  const handleConfirmPay = async () => {
    if (!payModal) return;
    setPaying(true);
    await put(`/split-payments/${payModal.planId}/installments/${payModal.instId}`, { paid: true });
    await post('/transactions', {
      date: payDate,
      payee: payModal.payee,
      category: 'Debt Payment',
      amount: -Math.abs(payModal.amount),
      notes: payNotes || null,
    });
    setPayModal(null);
    setPaying(false);
    load();
  };

  const handleMarkUnpaid = async (planId, instId) => {
    await put(`/split-payments/${planId}/installments/${instId}`, { paid: false });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this split payment plan?')) return;
    await del(`/split-payments/${id}`);
    load();
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setInstallments([{ ...EMPTY_INST }]);
    setAutoSplit({ count: '4', frequency: 'biweekly', firstDate: todayStr() });
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (plan) => {
    setForm({
      provider: plan.provider,
      description: plan.description,
      marketplace: plan.marketplace || '',
      total_amount: String(plan.total_amount),
    });
    setInstallments((plan.installments || []).map(i => ({
      amount: String(i.amount),
      due_date: i.due_date,
      paid: i.paid,
    })));
    setAutoSplit({ count: '4', frequency: 'biweekly', firstDate: todayStr() });
    setEditingId(plan.id);
    setError('');
    setShowModal(true);
  };

  const addInstallmentRow = () => setInstallments([...installments, { ...EMPTY_INST }]);
  const removeInstallmentRow = (i) => setInstallments(installments.filter((_, idx) => idx !== i));
  const updateInst = (i, field, value) => {
    const updated = [...installments];
    updated[i] = { ...updated[i], [field]: value };
    setInstallments(updated);
  };

  const generateInstallments = () => {
    const total = parseFloat(form.total_amount);
    const count = parseInt(autoSplit.count, 10);
    if (!total || total <= 0) { setError('Enter the total amount before generating installments.'); return; }
    if (!count || count < 1 || count > 60) { setError('Number of payments must be between 1 and 60.'); return; }
    if (!autoSplit.firstDate) { setError('Pick the first payment date.'); return; }
    setError('');

    // Split evenly; last payment absorbs the rounding remainder so rows sum to the total
    const base = Math.floor((total / count) * 100) / 100;
    const last = Math.round((total - base * (count - 1)) * 100) / 100;

    const rows = [];
    const d = new Date(autoSplit.firstDate + 'T00:00:00');
    for (let i = 0; i < count; i++) {
      rows.push({
        amount: String(i === count - 1 ? last : base),
        due_date: dateToStr(d),
      });
      if (autoSplit.frequency === 'weekly') d.setDate(d.getDate() + 7);
      else if (autoSplit.frequency === 'biweekly') d.setDate(d.getDate() + 14);
      else d.setMonth(d.getMonth() + 1);
    }
    setInstallments(rows);
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
        marketplace: form.marketplace.trim() || null,
        total_amount: parseFloat(form.total_amount),
        installments: validInsts.map(i => ({ amount: parseFloat(i.amount), due_date: i.due_date, paid: i.paid ? 1 : 0 }))
      };
      const data = editingId
        ? await put(`/split-payments/${editingId}`, payload)
        : await post('/split-payments', payload);
      if (data.error) { setError(data.error); return; }
      setShowModal(false);
      setForm(EMPTY_FORM);
      setInstallments([{ ...EMPTY_INST }]);
      setEditingId(null);
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
        <div className="flex-gap">
          <div className="view-toggle" role="group" aria-label="Layout">
            <button
              type="button"
              className={view === 'list' ? 'active' : ''}
              onClick={() => switchView('list')}
              title="List view"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2.4" rx="1.2"/>
                <rect x="1" y="6.8" width="14" height="2.4" rx="1.2"/>
                <rect x="1" y="11.6" width="14" height="2.4" rx="1.2"/>
              </svg>
              List
            </button>
            <button
              type="button"
              className={view === 'grid' ? 'active' : ''}
              onClick={() => switchView('grid')}
              title="Grid view"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6.2" height="6.2" rx="1.2"/>
                <rect x="8.8" y="1" width="6.2" height="6.2" rx="1.2"/>
                <rect x="1" y="8.8" width="6.2" height="6.2" rx="1.2"/>
                <rect x="8.8" y="8.8" width="6.2" height="6.2" rx="1.2"/>
              </svg>
              Grid
            </button>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            + Add Plan
          </button>
        </div>
      </div>

      {plans.length > 0 && (() => {
        const buckets = weeklyBuckets(plans);
        const maxVal = Math.max(...buckets.map(b => b.total), weeklyLimit, 1);
        const anyDue = buckets.some(b => b.total > 0);
        return (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="flex-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
              <div className="section-title">Installment Load — Next 8 Weeks</div>
              <div className="flex-gap" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Weekly limit:</span>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  style={{ width: 100 }}
                  placeholder="None"
                  value={limitInput}
                  onChange={e => setLimitInput(e.target.value)}
                />
                <button className="btn btn-ghost btn-sm" onClick={saveLimit}>Save</button>
              </div>
            </div>
            {!anyDue ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No unpaid installments in the next 8 weeks.</div>
            ) : (
              buckets.map((b, i) => {
                const over = weeklyLimit > 0 && b.total > weeklyLimit;
                return (
                  <div key={i} className="flex-gap" style={{ alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 110, flexShrink: 0 }}>{fmtRange(b)}</span>
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div
                        className={`progress-fill${over ? ' over' : ''}`}
                        style={{ width: Math.round((b.total / maxVal) * 100) + '%' }}
                      />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, width: 80, textAlign: 'right', color: over ? 'var(--danger)' : 'var(--text)' }}>
                      {b.total > 0 ? fmt(b.total) : '—'}
                    </span>
                  </div>
                );
              })
            )}
            {weeklyLimit > 0 && buckets.some(b => b.total > weeklyLimit) && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--danger)' }}>
                {buckets.filter(b => b.total > weeklyLimit).length} week(s) exceed your {fmt(weeklyLimit)} limit.
              </div>
            )}
          </div>
        );
      })()}

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
            <div className={view === 'grid' ? 'plan-grid' : ''}>
            {providerPlans.map(plan => {
              const totalPaid = (plan.installments || []).filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
              const totalUnpaid = (plan.installments || []).filter(i => !i.paid).reduce((s, i) => s + i.amount, 0);
              const pct = plan.total_amount > 0 ? Math.round((totalPaid / plan.total_amount) * 100) : 0;
              if (view === 'grid') {
                const nextUnpaid = (plan.installments || []).find(i => !i.paid);
                return (
                  <div className="plan-card plan-card-sq" key={plan.id}>
                    <div className="flex-between">
                      <span className={`badge ${PROVIDER_BADGE[plan.provider] || 'badge-other'}`}>{plan.provider}</span>
                      <span style={{ fontWeight: 700 }}>{fmt(plan.total_amount)}</span>
                    </div>
                    <div className="plan-sq-desc">{plan.description}</div>
                    {plan.marketplace && <div className="plan-sq-market">{plan.marketplace}</div>}
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: pct + '%' }} />
                    </div>
                    <div className="plan-meta">{pct}% paid &bull; {fmt(totalUnpaid)} left</div>
                    <div className="plan-sq-next">
                      {nextUnpaid ? <>Next: <strong>{fmt(nextUnpaid.amount)}</strong> on {nextUnpaid.due_date}</> : 'All paid'}
                    </div>
                    <div className="flex-gap" style={{ marginTop: 'auto' }}>
                      {nextUnpaid && (
                        <button className="btn btn-ghost btn-sm" onClick={() => openPayModal(plan.id, nextUnpaid.id, nextUnpaid.amount, plan.description || plan.marketplace || plan.provider)}>
                          Pay next
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(plan)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(plan.id)}>Delete</button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="plan-card" key={plan.id}>
                  <div className="plan-header">
                    <span className={`badge ${PROVIDER_BADGE[plan.provider] || 'badge-other'}`}>{plan.provider}</span>
                    <span className="plan-desc">
                      {plan.description}
                      {plan.marketplace && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}> &mdash; {plan.marketplace}</span>}
                    </span>
                    <span style={{ fontWeight: 700 }}>{fmt(plan.total_amount)}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(plan)}>Edit</button>
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
                            onChange={() => inst.paid
                              ? handleMarkUnpaid(plan.id, inst.id)
                              : openPayModal(plan.id, inst.id, inst.amount, plan.description || plan.marketplace || plan.provider)
                            }
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
          </div>
        ))
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editingId ? 'Edit Split Payment Plan' : 'Add Split Payment Plan'}</div>
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
                <label className="form-label">Marketplace (optional)</label>
                <input className="form-input" value={form.marketplace} onChange={e => setForm({...form, marketplace: e.target.value})} placeholder="e.g. Amazon, Best Buy" />
              </div>

              <div className="form-group" style={{ background: 'var(--accent-light)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
                <label className="form-label">Auto-generate installments</label>
                <div className="flex-gap" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="60"
                    value={autoSplit.count}
                    onChange={e => setAutoSplit({ ...autoSplit, count: e.target.value })}
                    style={{ width: 80 }}
                    title="Number of payments"
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>payments,</span>
                  <select
                    className="form-select"
                    value={autoSplit.frequency}
                    onChange={e => setAutoSplit({ ...autoSplit, frequency: e.target.value })}
                    style={{ width: 150 }}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>starting</span>
                  <input
                    className="form-input"
                    type="date"
                    value={autoSplit.firstDate}
                    onChange={e => setAutoSplit({ ...autoSplit, firstDate: e.target.value })}
                    style={{ width: 150 }}
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={generateInstallments}>Generate</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Splits the total evenly across the payments. You can still edit the rows below after generating.
                </div>
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
                    {!!inst.paid && <span style={{ fontSize: 12, color: 'var(--success)', whiteSpace: 'nowrap' }}>✓ paid</span>}
                    {installments.length > 1 && (
                      <button type="button" className="btn-icon" onClick={() => removeInstallmentRow(i)} title="Remove">✕</button>
                    )}
                  </div>
                ))}
              </div>

              {weeklyLimit > 0 && (() => {
                const projected = weeklyBuckets(plans, installments, editingId);
                const breached = projected.filter(b => b.total > weeklyLimit);
                if (breached.length === 0) return null;
                return (
                  <div className="error-msg" style={{ background: 'var(--warning-light)', color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)' }}>
                    Heads up: with this plan, {breached.length} week(s) would exceed your {fmt(weeklyLimit)}/week installment limit
                    ({breached.map(b => `${fmtRange(b)}: ${fmt(b.total)}`).join(', ')}).
                  </div>
                );
              })()}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Plan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Record Payment</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
              Mark <strong>{payModal.payee}</strong> installment of <strong>{fmt(payModal.amount)}</strong> as paid and log it as a transaction.
            </p>
            <div className="form-group">
              <label className="form-label">Payment date</label>
              <input
                className="form-input"
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input
                className="form-input"
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                placeholder="e.g. Paid via Apple Pay"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPayModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmPay} disabled={paying || !payDate}>
                {paying ? 'Saving...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
