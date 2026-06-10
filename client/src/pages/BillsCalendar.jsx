import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../api.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CATEGORIES = ['Housing', 'Utilities', 'Insurance', 'Subscription', 'Auto', 'Healthcare', 'Food', 'Entertainment', 'Other'];

const TYPE_LABELS = { bill: 'Bill', split: 'Split Payment', sub: 'Subscription', loan: 'Loan Payment' };

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Parse "YYYY-MM-DD" as a local date (new Date(str) treats it as UTC and can shift a day)
function parseLocal(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
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
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [splits, setSplits] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [drawerItem, setDrawerItem] = useState(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const loadData = () => {
    Promise.all([get('/bills'), get('/split-payments'), get('/subscriptions'), get('/loans')]).then(([b, s, su, l]) => {
      setBills(Array.isArray(b) ? b : []);
      setSplits(Array.isArray(s) ? s : []);
      setSubs(Array.isArray(su) ? su : []);
      setLoans(Array.isArray(l) ? l : []);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const cells = buildCalendar(viewYear, viewMonth);

  function getItemsForDay(day) {
    const result = [];
    bills.forEach(bill => {
      if (bill.recurrence === 'monthly' && bill.due_day === day) {
        result.push({ type: 'bill', name: bill.name, amount: bill.amount, data: bill });
      } else if (bill.recurrence === 'yearly' && bill.due_date) {
        const d = parseLocal(bill.due_date);
        if (d && d.day === day && d.month === viewMonth) {
          result.push({ type: 'bill', name: bill.name, amount: bill.amount, data: bill });
        }
      } else if (bill.recurrence === 'one-time' && bill.due_date) {
        const d = parseLocal(bill.due_date);
        if (d && d.day === day && d.month === viewMonth && d.year === viewYear) {
          result.push({ type: 'bill', name: bill.name, amount: bill.amount, data: bill });
        }
      }
    });
    splits.forEach(sp => {
      (sp.installments || []).forEach(inst => {
        const d = parseLocal(inst.due_date);
        if (d && d.day === day && d.month === viewMonth && d.year === viewYear) {
          result.push({ type: 'split', name: sp.description, amount: inst.amount, data: sp, installment: inst });
        }
      });
    });
    subs.forEach(sub => {
      if (!sub.active) return;
      if (sub.billing_cycle === 'monthly' && sub.due_day === day) {
        result.push({ type: 'sub', name: sub.name, amount: sub.amount, data: sub });
      } else if (sub.billing_cycle === 'yearly' && sub.renewal_date) {
        const d = parseLocal(sub.renewal_date);
        if (d && d.day === day && d.month === viewMonth) {
          result.push({ type: 'sub', name: sub.name, amount: sub.amount, data: sub });
        }
      }
    });
    loans.forEach(loan => {
      if (loan.current_balance <= 0 || !loan.start_date) return;
      const d = parseLocal(loan.start_date);
      if (d && d.day === day) {
        result.push({ type: 'loan', name: loan.name, amount: loan.monthly_payment, data: loan });
      }
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

  const markInstallmentPaid = async (item, paid) => {
    await put(`/split-payments/${item.data.id}/installments/${item.installment.id}`, { paid });
    setDrawerItem({ ...item, installment: { ...item.installment, paid: paid ? 1 : 0 } });
    loadData();
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  const drawerRows = (item) => {
    if (item.type === 'bill') {
      const b = item.data;
      return [
        ['Amount', fmt(b.amount)],
        ['Recurrence', b.recurrence],
        ['Due', b.recurrence === 'monthly' ? `Day ${b.due_day} of each month` : (b.due_date || `Day ${b.due_day}`)],
        ['Category', b.category || '—'],
        ['Notes', b.notes || '—'],
      ];
    }
    if (item.type === 'split') {
      const sp = item.data;
      const inst = item.installment;
      const instList = sp.installments || [];
      const paidCount = instList.filter(i => i.paid).length;
      const totalPaid = instList.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
      const idx = instList.findIndex(i => i.id === inst.id);
      return [
        ['This payment', fmt(inst.amount) + (inst.paid ? ' (paid)' : '')],
        ['Due date', inst.due_date],
        ['Installment', `${idx + 1} of ${instList.length}`],
        ['Provider', sp.provider],
        ['Marketplace', sp.marketplace || '—'],
        ['Plan total', fmt(sp.total_amount)],
        ['Plan progress', `${paidCount}/${instList.length} paid — ${fmt(totalPaid)} of ${fmt(sp.total_amount)}`],
      ];
    }
    if (item.type === 'sub') {
      const s = item.data;
      return [
        ['Amount', fmt(s.amount)],
        ['Billing cycle', s.billing_cycle],
        ['Renews', s.billing_cycle === 'monthly' ? `Day ${s.due_day} of each month` : (s.renewal_date || '—')],
        ['Category', s.category || '—'],
        ['Yearly cost', fmt(s.billing_cycle === 'yearly' ? s.amount : s.amount * 12)],
        ['Notes', s.notes || '—'],
      ];
    }
    // loan
    const l = item.data;
    const monthsLeft = l.monthly_payment > 0 ? Math.ceil(l.current_balance / l.monthly_payment) : null;
    return [
      ['Monthly payment', fmt(l.monthly_payment)],
      ['Current balance', fmt(l.current_balance)],
      ['Original amount', fmt(l.original_amount)],
      ['Interest rate', `${l.interest_rate}%`],
      ['Payment day', `Day ${parseLocal(l.start_date)?.day ?? '—'} of each month`],
      ['Rough months left', monthsLeft ? `~${monthsLeft} (before interest)` : '—'],
    ];
  };

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

        <div className="calendar-legend">
          <span className="legend-item"><span className="legend-dot chip-bill" />Bills</span>
          <span className="legend-item"><span className="legend-dot chip-split" />Split Payments</span>
          <span className="legend-item"><span className="legend-dot chip-sub" />Subscriptions</span>
          <span className="legend-item"><span className="legend-dot chip-loan" />Loan Payments</span>
        </div>

        <div className="calendar-grid">
          {DAYS.map(d => (
            <div className="calendar-day-header" key={d}>{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div className="calendar-cell empty" key={i} />;
            const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
            const items = getItemsForDay(day);
            return (
              <div className={`calendar-cell${isToday ? ' today' : ''}`} key={i}>
                <div className="cell-day-num">{day}</div>
                {items.map((item, j) => (
                  <button
                    key={j}
                    className={`calendar-chip chip-${item.type}`}
                    title={`${item.name} — ${fmt(item.amount)}`}
                    onClick={() => setDrawerItem(item)}
                  >
                    {item.name} — {fmt(item.amount)}
                  </button>
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
                <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Rent" />
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

      {drawerItem && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerItem(null)} />
          <div className="drawer">
            <button className="btn btn-icon drawer-close" onClick={() => setDrawerItem(null)} aria-label="Close">✕</button>
            <span className={`badge chip-${drawerItem.type}`} style={{ marginBottom: 12, display: 'inline-block' }}>
              {TYPE_LABELS[drawerItem.type]}
            </span>
            <div className="drawer-title">{drawerItem.name}</div>
            <div className="drawer-amount">{fmt(drawerItem.amount)}</div>
            <div className="drawer-rows">
              {drawerRows(drawerItem).map(([label, value]) => (
                <div className="drawer-row" key={label}>
                  <span className="drawer-label">{label}</span>
                  <span className="drawer-value">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex-gap" style={{ marginTop: 20, flexWrap: 'wrap' }}>
              {drawerItem.type === 'bill' && (
                <button className="btn btn-primary btn-sm" onClick={() => { setDrawerItem(null); openEdit(drawerItem.data); }}>
                  Edit Bill
                </button>
              )}
              {drawerItem.type === 'split' && (
                <>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => markInstallmentPaid(drawerItem, !drawerItem.installment.paid)}
                  >
                    {drawerItem.installment.paid ? 'Mark Unpaid' : 'Mark Paid'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/split-payments')}>View Plan</button>
                </>
              )}
              {drawerItem.type === 'sub' && (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/subscriptions')}>Manage Subscriptions</button>
              )}
              {drawerItem.type === 'loan' && (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/loans')}>View Loan</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
