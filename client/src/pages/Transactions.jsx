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

  const load = () => {
    setLoading(true);
    get(`/transactions?year=${viewYear}&month=${viewMonth}`).then(data => {
      setTxs(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [viewYear, viewMonth]);

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
    </div>
  );
}
