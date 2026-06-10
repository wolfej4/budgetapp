import React, { useEffect, useState } from 'react';
import { get, post, put, del } from '../api.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CATEGORIES = [
  'Income', 'Groceries', 'Dining', 'Transport', 'Gas', 'Entertainment', 'Shopping',
  'Utilities', 'Rent/Mortgage', 'Health', 'Subscriptions', 'Debt Payment', 'Savings', 'Other'
];

function fmt(n) {
  return '$' + Math.abs(Number(n || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY_FORM = { date: '', payee: '', category: 'Other', type: 'expense', amount: '', notes: '' };

export default function Transactions() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [budgets, setBudgets] = useState([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetEdits, setBudgetEdits] = useState({});
  const [allTxs, setAllTxs] = useState([]);
  const [subNames, setSubNames] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissedSuggestions') || '[]'); } catch { return []; }
  });

  const load = () => {
    setLoading(true);
    get(`/transactions?year=${viewYear}&month=${viewMonth}`).then(data => {
      setTxs(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  const loadExtras = () => {
    get('/category-budgets').then(data => setBudgets(Array.isArray(data) ? data : []));
    get('/transactions').then(data => setAllTxs(Array.isArray(data) ? data : []));
    get('/subscriptions').then(data => setSubNames((Array.isArray(data) ? data : []).map(s => s.name.toLowerCase())));
  };

  useEffect(() => { load(); }, [viewYear, viewMonth]);
  useEffect(() => { loadExtras(); }, []);

  // Spending per category for the viewed month
  const spentByCategory = {};
  txs.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category || 'Other';
    spentByCategory[cat] = (spentByCategory[cat] || 0) - t.amount;
  });

  // Detect recurring expenses: same payee + amount in 2+ distinct months,
  // not already a subscription and not dismissed
  const suggestions = (() => {
    const groups = {};
    allTxs.filter(t => t.amount < 0).forEach(t => {
      const key = `${t.payee.toLowerCase()}|${Math.abs(t.amount)}`;
      if (!groups[key]) groups[key] = { payee: t.payee, amount: Math.abs(t.amount), months: new Set(), latest: t.date };
      groups[key].months.add(t.date.slice(0, 7));
      if (t.date > groups[key].latest) groups[key].latest = t.date;
    });
    return Object.entries(groups)
      .filter(([key, g]) =>
        g.months.size >= 2 &&
        !dismissed.includes(key) &&
        !subNames.includes(g.payee.toLowerCase())
      )
      .map(([key, g]) => ({ key, ...g }));
  })();

  const dismissSuggestion = (key) => {
    const next = [...dismissed, key];
    setDismissed(next);
    localStorage.setItem('dismissedSuggestions', JSON.stringify(next));
  };

  const makeSubscription = async (sug) => {
    await post('/subscriptions', {
      name: sug.payee,
      amount: sug.amount,
      billing_cycle: 'monthly',
      due_day: Number(sug.latest.slice(8, 10)),
      category: 'Other'
    });
    dismissSuggestion(sug.key);
    loadExtras();
  };

  const openBudgetModal = () => {
    const edits = {};
    for (const b of budgets) edits[b.category] = String(b.monthly_limit);
    setBudgetEdits(edits);
    setShowBudgetModal(true);
  };

  const saveBudgets = async () => {
    for (const cat of CATEGORIES.filter(c => c !== 'Income')) {
      const newVal = parseFloat(budgetEdits[cat]) || 0;
      const existing = budgets.find(b => b.category === cat);
      const oldVal = existing ? existing.monthly_limit : 0;
      if (newVal !== oldVal) {
        await put('/category-budgets', { category: cat, monthly_limit: newVal });
      }
    }
    setShowBudgetModal(false);
    loadExtras();
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const inflow = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = txs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const net = inflow + outflow;

  const visible = filterCat ? txs.filter(t => t.category === filterCat) : txs;

  const openAdd = () => {
    setEditTx(null);
    setForm({ ...EMPTY_FORM, date: todayStr() });
    setError('');
    setShowModal(true);
  };

  const openEdit = (tx) => {
    setEditTx(tx);
    setForm({
      date: tx.date,
      payee: tx.payee,
      category: tx.category || 'Other',
      type: tx.amount < 0 ? 'expense' : 'income',
      amount: String(Math.abs(tx.amount)),
      notes: tx.notes || ''
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const raw = parseFloat(form.amount);
    const signed = form.type === 'expense' ? -Math.abs(raw) : Math.abs(raw);
    const payload = {
      date: form.date,
      payee: form.payee,
      category: form.category,
      amount: signed,
      notes: form.notes || null
    };
    try {
      const data = editTx
        ? await put(`/transactions/${editTx.id}`, payload)
        : await post('/transactions', payload);
      if (data.error) { setError(data.error); return; }
      setShowModal(false);
      load();
      loadExtras();
    } catch {
      setError('Failed to save transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    await del(`/transactions/${id}`);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Transactions</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Transaction</button>
      </div>

      <div className="card-grid">
        <div className="summary-card">
          <div className="card-label">Inflow</div>
          <div className="card-value" style={{ color: 'var(--success)' }}>{fmt(inflow)}</div>
          <div className="card-sub">{MONTHS[viewMonth]} {viewYear}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Outflow</div>
          <div className="card-value" style={{ color: 'var(--danger)' }}>-{fmt(outflow)}</div>
          <div className="card-sub">{txs.filter(t => t.amount < 0).length} expense{txs.filter(t => t.amount < 0).length !== 1 ? 's' : ''}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Net</div>
          <div className="card-value" style={{ color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {net >= 0 ? '+' : '-'}{fmt(net)}
          </div>
          <div className="card-sub">Inflow minus outflow</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="flex-between" style={{ marginBottom: budgets.length ? 16 : 0 }}>
          <div className="section-title">Category Budgets — {MONTHS[viewMonth]}</div>
          <button className="btn btn-ghost btn-sm" onClick={openBudgetModal}>Manage</button>
        </div>
        {budgets.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            No category limits set. Click Manage to set monthly spending caps.
          </div>
        ) : (
          budgets.map(b => {
            const spent = spentByCategory[b.category] || 0;
            const pct = Math.min(Math.round((spent / b.monthly_limit) * 100), 100);
            const ratio = spent / b.monthly_limit;
            const cls = ratio > 1 ? ' over' : ratio >= 0.8 ? ' warn' : '';
            return (
              <div key={b.category} style={{ marginBottom: 12 }}>
                <div className="flex-between" style={{ fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{b.category}</span>
                  <span style={{ color: ratio > 1 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {fmt(spent)} of {fmt(b.monthly_limit)}{ratio > 1 ? ` — ${fmt(spent - b.monthly_limit)} over` : ''}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className={`progress-fill${cls}`} style={{ width: pct + '%' }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--warning)' }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Looks Recurring</div>
          {suggestions.map(sug => (
            <div key={sug.key} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 14 }}>
                <strong>{sug.payee}</strong> — {fmt(sug.amount)} seen in {sug.months.size} different months
              </span>
              <span className="flex-gap">
                <button className="btn btn-primary btn-sm" onClick={() => makeSubscription(sug)}>Make Subscription</button>
                <button className="btn btn-ghost btn-sm" onClick={() => dismissSuggestion(sug.key)}>Dismiss</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div className="flex-gap">
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}>&#8249;</button>
            <div style={{ fontWeight: 600, minWidth: 150, textAlign: 'center' }}>{MONTHS[viewMonth]} {viewYear}</div>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}>&#8250;</button>
          </div>
          <select className="form-select" style={{ width: 180 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-text">No transactions {filterCat ? 'in this category ' : ''}this month.</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payee</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{tx.date}</td>
                    <td style={{ fontWeight: 600 }}>{tx.payee}</td>
                    <td>{tx.category || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: tx.amount >= 0 ? 'var(--success)' : 'var(--text)' }}>
                      {tx.amount >= 0 ? '+' : '-'}{fmt(tx.amount)}
                    </td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.notes || '—'}</td>
                    <td>
                      <div className="flex-gap">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tx)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(tx.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editTx ? 'Edit Transaction' : 'Add Transaction'}</div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <div className="view-toggle" style={{ width: 'fit-content' }}>
                    <button type="button" className={form.type === 'expense' ? 'active' : ''} onClick={() => setForm({...form, type: 'expense'})}>Expense</button>
                    <button type="button" className={form.type === 'income' ? 'active' : ''} onClick={() => setForm({...form, type: 'income'})}>Income</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Payee</label>
                <input className="form-input" required value={form.payee} onChange={e => setForm({...form, payee: e.target.value})} placeholder={form.type === 'expense' ? 'e.g. Kroger' : 'e.g. Paycheck'} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0.00" />
                </div>
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
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editTx ? 'Update' : 'Add Transaction')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBudgetModal && (
        <div className="modal-overlay" onClick={() => setShowBudgetModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Category Budgets</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              Set a monthly spending cap per category. Leave blank or 0 for no limit.
            </p>
            {CATEGORIES.filter(c => c !== 'Income').map(cat => (
              <div key={cat} className="flex-between" style={{ marginBottom: 10, gap: 12 }}>
                <label className="form-label" style={{ marginBottom: 0, flex: 1 }}>{cat}</label>
                <input
                  className="form-input"
                  type="number"
                  step="1"
                  min="0"
                  style={{ width: 120 }}
                  placeholder="No limit"
                  value={budgetEdits[cat] || ''}
                  onChange={e => setBudgetEdits({ ...budgetEdits, [cat]: e.target.value })}
                />
              </div>
            ))}
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowBudgetModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveBudgets}>Save Budgets</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
