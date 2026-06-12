import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get, post, put, del } from '../api.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CATEGORIES = [
  'Income', 'Groceries', 'Dining', 'Transport', 'Gas', 'Entertainment', 'Shopping',
  'Utilities', 'Rent/Mortgage', 'Health', 'Subscriptions', 'Debt Payment', 'Savings', 'Other'
];
const FREQUENCIES = [
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly',  label: 'Monthly' },
  { value: 'yearly',   label: 'Yearly' },
];
const DAYS_OF_WEEK = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function fmt(n) {
  return '$' + Math.abs(Number(n || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY_FORM = { date: '', payee: '', category: 'Other', type: 'expense', amount: '', notes: '', account_id: '' };
const EMPTY_REC = { payee: '', category: 'Other', type: 'expense', amount: '', notes: '', frequency: 'monthly', day_of_month: '', day_of_week: '', start_date: '', end_date: '' };

export default function Transactions() {
  const today = new Date();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('transactions');
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
  const [filterAccount, setFilterAccount] = useState(() => searchParams.get('account_id') || '');
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetEdits, setBudgetEdits] = useState({});
  const [allTxs, setAllTxs] = useState([]);
  const [subNames, setSubNames] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissedSuggestions') || '[]'); } catch { return []; }
  });

  // Recurring state
  const [recurring, setRecurring] = useState([]);
  const [showRecModal, setShowRecModal] = useState(false);
  const [editRec, setEditRec] = useState(null);
  const [recForm, setRecForm] = useState(EMPTY_REC);
  const [recError, setRecError] = useState('');
  const [recSaving, setRecSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');

  const load = () => {
    setLoading(true);
    const acctQ = filterAccount ? `&account_id=${filterAccount}` : '';
    get(`/transactions?year=${viewYear}&month=${viewMonth}${acctQ}`).then(data => {
      setTxs(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  const loadExtras = () => {
    get('/category-budgets').then(data => setBudgets(Array.isArray(data) ? data : []));
    get('/transactions').then(data => setAllTxs(Array.isArray(data) ? data : []));
    get('/subscriptions').then(data => setSubNames((Array.isArray(data) ? data : []).map(s => s.name.toLowerCase())));
    get('/accounts').then(data => setAccounts(Array.isArray(data) ? data : []));
  };

  const loadRecurring = () => {
    get('/recurring-transactions').then(data => setRecurring(Array.isArray(data) ? data : []));
  };

  useEffect(() => { load(); }, [viewYear, viewMonth, filterAccount]);
  useEffect(() => { loadExtras(); loadRecurring(); }, []);

  // Spending per category for the viewed month
  const spentByCategory = {};
  txs.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category || 'Other';
    spentByCategory[cat] = (spentByCategory[cat] || 0) - t.amount;
  });

  const suggestions = (() => {
    const groups = {};
    allTxs.filter(t => t.amount < 0).forEach(t => {
      const key = `${t.payee.toLowerCase()}|${Math.abs(t.amount)}`;
      if (!groups[key]) groups[key] = { payee: t.payee, amount: Math.abs(t.amount), months: new Set(), latest: t.date };
      groups[key].months.add(t.date.slice(0, 7));
      if (t.date > groups[key].latest) groups[key].latest = t.date;
    });
    return Object.entries(groups)
      .filter(([key, g]) => g.months.size >= 2 && !dismissed.includes(key) && !subNames.includes(g.payee.toLowerCase()))
      .map(([key, g]) => ({ key, ...g }));
  })();

  const dismissSuggestion = (key) => {
    const next = [...dismissed, key];
    setDismissed(next);
    localStorage.setItem('dismissedSuggestions', JSON.stringify(next));
  };

  const makeSubscription = async (sug) => {
    await post('/subscriptions', { name: sug.payee, amount: sug.amount, billing_cycle: 'monthly', due_day: Number(sug.latest.slice(8, 10)), category: 'Other' });
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
      if (newVal !== (existing ? existing.monthly_limit : 0)) {
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
    setForm({ date: tx.date, payee: tx.payee, category: tx.category || 'Other', type: tx.amount < 0 ? 'expense' : 'income', amount: String(Math.abs(tx.amount)), notes: tx.notes || '', account_id: tx.account_id ? String(tx.account_id) : '' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const raw = parseFloat(form.amount);
    const signed = form.type === 'expense' ? -Math.abs(raw) : Math.abs(raw);
    const payload = { date: form.date, payee: form.payee, category: form.category, amount: signed, notes: form.notes || null, account_id: form.account_id ? Number(form.account_id) : null };
    try {
      const data = editTx ? await put(`/transactions/${editTx.id}`, payload) : await post('/transactions', payload);
      if (data.error) { setError(data.error); return; }
      setShowModal(false);
      load();
      loadExtras();
    } catch { setError('Failed to save transaction.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    await del(`/transactions/${id}`);
    load();
  };

  // Recurring handlers
  const openAddRec = () => {
    setEditRec(null);
    setRecForm({ ...EMPTY_REC, start_date: todayStr() });
    setRecError('');
    setShowRecModal(true);
  };

  const openEditRec = (r) => {
    setEditRec(r);
    setRecForm({
      payee: r.payee, category: r.category || 'Other',
      type: r.amount < 0 ? 'expense' : 'income',
      amount: String(Math.abs(r.amount)), notes: r.notes || '',
      frequency: r.frequency, day_of_month: r.day_of_month != null ? String(r.day_of_month) : '',
      day_of_week: r.day_of_week != null ? String(r.day_of_week) : '',
      start_date: r.start_date, end_date: r.end_date || '',
    });
    setRecError('');
    setShowRecModal(true);
  };

  const handleRecSubmit = async (e) => {
    e.preventDefault();
    setRecError('');
    setRecSaving(true);
    const raw = parseFloat(recForm.amount);
    const signed = recForm.type === 'expense' ? -Math.abs(raw) : Math.abs(raw);
    const payload = {
      payee: recForm.payee, category: recForm.category, amount: signed,
      notes: recForm.notes || null, frequency: recForm.frequency,
      day_of_month: recForm.day_of_month ? Number(recForm.day_of_month) : null,
      day_of_week: recForm.day_of_week !== '' ? Number(recForm.day_of_week) : null,
      start_date: recForm.start_date,
      end_date: recForm.end_date || null,
    };
    try {
      const data = editRec
        ? await put(`/recurring-transactions/${editRec.id}`, payload)
        : await post('/recurring-transactions', payload);
      if (data.error) { setRecError(data.error); return; }
      setShowRecModal(false);
      loadRecurring();
    } catch { setRecError('Failed to save.'); }
    finally { setRecSaving(false); }
  };

  const handleDeleteRec = async (id) => {
    if (!window.confirm('Delete this recurring rule? Already-generated transactions are kept.')) return;
    await del(`/recurring-transactions/${id}`);
    loadRecurring();
  };

  const handleToggleActive = async (r) => {
    await put(`/recurring-transactions/${r.id}`, { active: !r.active });
    loadRecurring();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateMsg('');
    const data = await post('/recurring-transactions/generate', {});
    setGenerateMsg(data.created === 0 ? 'All up to date — no new transactions.' : `Generated ${data.created} transaction${data.created !== 1 ? 's' : ''}.`);
    setGenerating(false);
    load();
    loadExtras();
  };

  const freqLabel = (r) => {
    if (r.frequency === 'weekly' || r.frequency === 'biweekly') {
      return `${FREQUENCIES.find(f => f.value === r.frequency)?.label} on ${DAYS_OF_WEEK[r.day_of_week ?? 0]}`;
    }
    if (r.frequency === 'monthly') return `Monthly on day ${r.day_of_month ?? '?'}`;
    return FREQUENCIES.find(f => f.value === r.frequency)?.label ?? r.frequency;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Transactions</div>
        <div className="flex-gap">
          {tab === 'transactions' && <button className="btn btn-primary" onClick={openAdd}>+ Add Transaction</button>}
          {tab === 'recurring' && <button className="btn btn-primary" onClick={openAddRec}>+ Add Rule</button>}
        </div>
      </div>

      <div className="view-toggle" style={{ marginBottom: 24, width: 'fit-content' }}>
        <button className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>Transactions</button>
        <button className={tab === 'recurring' ? 'active' : ''} onClick={() => setTab('recurring')}>Recurring</button>
      </div>

      {tab === 'transactions' && (
        <>
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
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No category limits set. Click Manage to set monthly spending caps.</div>
            ) : budgets.map(b => {
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
                  <div className="progress-bar"><div className={`progress-fill${cls}`} style={{ width: pct + '%' }} /></div>
                </div>
              );
            })}
          </div>

          {suggestions.length > 0 && (
            <div className="card" style={{ marginBottom: 24, borderColor: 'var(--warning)' }}>
              <div className="section-title" style={{ marginBottom: 12 }}>Looks Recurring</div>
              {suggestions.map(sug => (
                <div key={sug.key} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 14 }}><strong>{sug.payee}</strong> — {fmt(sug.amount)} seen in {sug.months.size} different months</span>
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
              <select className="form-select" style={{ width: 160 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {accounts.length > 0 && (
                <select className="form-select" style={{ width: 160 }} value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
                  <option value="">All accounts</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : visible.length === 0 ? (
              <div className="empty-state"><div className="empty-state-text">No transactions {filterCat ? 'in this category ' : ''}this month.</div></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Payee</th><th>Category</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      {accounts.length > 0 && <th>Account</th>}
                      <th>Notes</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{tx.date}</td>
                        <td style={{ fontWeight: 600 }}>
                          {tx.payee}
                          {tx.recurring_id && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 4, padding: '1px 5px' }}>auto</span>}
                        </td>
                        <td>{tx.category || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: tx.amount >= 0 ? 'var(--success)' : 'var(--text)' }}>
                          {tx.amount >= 0 ? '+' : '-'}{fmt(tx.amount)}
                        </td>
                        {accounts.length > 0 && (
                          <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 13 }}>
                            {(() => {
                              const acct = accounts.find(a => a.id === tx.account_id);
                              return acct ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: acct.color, display: 'inline-block' }} />{acct.name}</span> : '—';
                            })()}
                          </td>
                        )}
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
        </>
      )}

      {tab === 'recurring' && (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
              Recurring rules automatically generate transactions on their schedule. Click <strong>Generate Now</strong> to post any that are due up to today.
            </div>
            <div className="flex-gap" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating...' : 'Generate Now'}
              </button>
              {generateMsg && <span style={{ fontSize: 14, color: 'var(--text-muted)', alignSelf: 'center' }}>{generateMsg}</span>}
            </div>
          </div>

          {recurring.length === 0 ? (
            <div className="card"><div className="empty-state"><div className="empty-state-text">No recurring rules yet. Add one to get started.</div></div></div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Payee</th><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th><th>Schedule</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {recurring.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.payee}</td>
                        <td>{r.category}</td>
                        <td style={{ textAlign: 'right', color: r.amount < 0 ? 'var(--text)' : 'var(--success)', fontWeight: 600 }}>
                          {r.amount >= 0 ? '+' : '-'}{fmt(r.amount)}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{freqLabel(r)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.start_date}</td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{r.end_date || '—'}</td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, color: r.active ? 'var(--success)' : 'var(--text-dim)' }}>
                            {r.active ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td>
                          <div className="flex-gap">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEditRec(r)}>Edit</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleToggleActive(r)}>{r.active ? 'Pause' : 'Resume'}</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteRec(r.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Transaction modal */}
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
              {accounts.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Account (optional)</label>
                  <select className="form-select" value={form.account_id} onChange={e => setForm({...form, account_id: e.target.value})}>
                    <option value="">— Unassigned —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
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

      {/* Recurring rule modal */}
      {showRecModal && (
        <div className="modal-overlay" onClick={() => setShowRecModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editRec ? 'Edit Recurring Rule' : 'Add Recurring Rule'}</div>
            {recError && <div className="error-msg">{recError}</div>}
            <form onSubmit={handleRecSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <div className="view-toggle" style={{ width: 'fit-content' }}>
                    <button type="button" className={recForm.type === 'expense' ? 'active' : ''} onClick={() => setRecForm({...recForm, type: 'expense'})}>Expense</button>
                    <button type="button" className={recForm.type === 'income' ? 'active' : ''} onClick={() => setRecForm({...recForm, type: 'income'})}>Income</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Frequency</label>
                  <select className="form-select" value={recForm.frequency} onChange={e => setRecForm({...recForm, frequency: e.target.value})}>
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Payee</label>
                <input className="form-input" required value={recForm.payee} onChange={e => setRecForm({...recForm, payee: e.target.value})} placeholder="e.g. Netflix, Paycheck" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0.01" required value={recForm.amount} onChange={e => setRecForm({...recForm, amount: e.target.value})} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={recForm.category} onChange={e => setRecForm({...recForm, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {(recForm.frequency === 'monthly') && (
                <div className="form-group">
                  <label className="form-label">Day of month (1–31)</label>
                  <input className="form-input" type="number" min="1" max="31" required value={recForm.day_of_month} onChange={e => setRecForm({...recForm, day_of_month: e.target.value})} placeholder="e.g. 15" />
                </div>
              )}
              {(recForm.frequency === 'weekly' || recForm.frequency === 'biweekly') && (
                <div className="form-group">
                  <label className="form-label">Day of week</label>
                  <select className="form-select" value={recForm.day_of_week} onChange={e => setRecForm({...recForm, day_of_week: e.target.value})}>
                    {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start date</label>
                  <input className="form-input" type="date" required value={recForm.start_date} onChange={e => setRecForm({...recForm, start_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">End date (optional)</label>
                  <input className="form-input" type="date" value={recForm.end_date} onChange={e => setRecForm({...recForm, end_date: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={recForm.notes} onChange={e => setRecForm({...recForm, notes: e.target.value})} placeholder="Optional notes..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRecModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={recSaving}>{recSaving ? 'Saving...' : (editRec ? 'Update' : 'Add Rule')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget modal */}
      {showBudgetModal && (
        <div className="modal-overlay" onClick={() => setShowBudgetModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Category Budgets</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Set a monthly spending cap per category. Leave blank or 0 for no limit.</p>
            {CATEGORIES.filter(c => c !== 'Income').map(cat => (
              <div key={cat} className="flex-between" style={{ marginBottom: 10, gap: 12 }}>
                <label className="form-label" style={{ marginBottom: 0, flex: 1 }}>{cat}</label>
                <input className="form-input" type="number" step="1" min="0" style={{ width: 120 }} placeholder="No limit" value={budgetEdits[cat] || ''} onChange={e => setBudgetEdits({ ...budgetEdits, [cat]: e.target.value })} />
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
