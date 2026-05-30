import React, { useEffect, useState } from 'react';
import { get, post, put, del } from '../api.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CATEGORIES = ['Housing', 'Utilities', 'Insurance', 'Subscription', 'Auto', 'Healthcare', 'Food', 'Entertainment', 'Other'];

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const EMPTY_FORM = {
  name: '', amount: '', due_day: '', recurrence: 'monthly',
  due_date: '', category: '', notes: ''
};

export default function BillsCalendar() {
  const [bills, setBills] = useState([]);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const loadData = () => {
    Promise.all([get('/bills'), get('/split-payments')]).then(([b, s]) => {
      setBills(Array.isArray(b) ? b : []);
      setSplits(Array.isArray(s) ? s : []);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const cells = buildCalendar(viewYear, viewMonth);

  function getBillsForDay(day) {
    const result = [];
    bills.forEach(bill => {
      if (bill.recurrence === 'monthly' && bill.due_day === day) {
        result.push({ type: 'bill', name: bill.name, amount: bill.amount });
      } else if (bill.recurrence === 'yearly' && bill.due_date) {
        const d = new Date(bill.due_date);
        if (d.getDate() === day && d.getMonth() === viewMonth) {
          result.push({ type: 'bill', name: bill.name, amount: bill.amount });
        }
      } else if (bill.recurrence === 'one-time' && bill.due_date) {
        const d = new Date(bill.due_date);
        if (d.getDate() === day && d.getMonth() === viewMonth && d.getFullYear() === viewYear) {
          result.push({ type: 'bill', name: bill.name, amount: bill.amount });
        }
      }
    });
    splits.forEach(sp => {
      (sp.installments || []).forEach(inst => {
        const d = new Date(inst.due_date);
        if (d.getDate() === day && d.getMonth() === viewMonth && d.getFullYear() === viewYear) {
          result.push({ type: 'split', name: sp.description, amount: inst.amount });
        }
      });
    });
    return result;
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const openAdd = () => {
    setEditBill(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (bill) => {
    setEditBill(bill);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      due_day: String(bill.due_day),
      recurrence: bill.recurrence || 'monthly',
      due_date: bill.due_date || '',
      category: bill.category || '',
      notes: bill.notes || ''
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
      due_day: parseInt(form.due_day) || 1,
      recurrence: form.recurrence,
      due_date: form.due_date || null,
      category: form.category || null,
      notes: form.notes || null
    };
    try {
      let data;
      if (editBill) {
        data = await put(`/bills/${editBill.id}`, payload);
      } else {
        data = await post('/bills', payload);
      }
      if (data.error) { setError(data.error); return; }
      setShowModal(false);
      loadData();
    } catch {
      setError('Failed to save bill.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bill?')) return;
    await del(`/bills/${id}`);
    loadData();
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Bills Calendar</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Bill</button>
      </div>

      <div className="card calendar-wrapper">
        <div className="calendar-header">
          <button className="btn btn-ghost btn-sm" onClick={prevMonth}>&#8249;</button>
          <div className="calendar-title">{MONTHS[viewMonth]} {viewYear}</div>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth}>&#8250;</button>
        </div>

        <div className="calendar-grid">
          {DAYS.map(d => (
            <div className="calendar-day-header" key={d}>{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div className="calendar-cell empty" key={i} />;
            const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
            const items = getBillsForDay(day);
            return (
              <div className={`calendar-cell${isToday ? ' today' : ''}`} key={i}>
                <div className="cell-day-num">{day}</div>
                {items.map((item, j) => (
                  <span
                    key={j}
                    className={`calendar-chip ${item.type === 'bill' ? 'chip-bill' : 'chip-split'}`}
                    title={`${item.name} — ${fmt(item.amount)}`}
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">All Bills</div>
        </div>
        {bills.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">No bills yet. Add your first bill!</div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Amount</th>
                    <th>Due</th>
                    <th>Recurrence</th>
                    <th>Category</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(bill => (
                    <tr key={bill.id}>
                      <td>{bill.name}</td>
                      <td>{fmt(bill.amount)}</td>
                      <td>
                        {bill.recurrence === 'monthly' ? `Day ${bill.due_day}` : bill.due_date || `Day ${bill.due_day}`}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{bill.recurrence}</td>
                      <td>{bill.category || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bill.notes || '—'}</td>
                      <td>
                        <div className="flex-gap">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(bill)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(bill.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editBill ? 'Edit Bill' : 'Add Bill'}</div>
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
                  <label className="form-label">Due Day (1-31)</label>
                  <input className="form-input" type="number" min="1" max="31" required value={form.due_day} onChange={e => setForm({...form, due_day: e.target.value})} placeholder="15" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Recurrence</label>
                  <select className="form-select" value={form.recurrence} onChange={e => setForm({...form, recurrence: e.target.value})}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one-time">One-time</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="">— Select —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {(form.recurrence === 'yearly' || form.recurrence === 'one-time') && (
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input className="form-input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional notes..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editBill ? 'Update' : 'Add Bill')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
