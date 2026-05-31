import React, { useEffect, useState } from 'react';
import { get, post, put, del } from '../api.js';

const CATEGORIES = ['job', 'freelance', 'gift', 'refund', 'other'];
const RECURRENCES = ['one-time', 'weekly', 'biweekly', 'monthly'];

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyForm = { source: '', amount: '', date: new Date().toISOString().slice(0, 10), recurrence: 'one-time', category: 'job', notes: '' };

export default function Income() {
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  useEffect(() => {
    fetchIncome();
  }, []);

  async function fetchIncome() {
    const data = await get('/income');
    setIncome(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  // Expand recurring for this month
  function expandThisMonth(items) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const results = [];
    for (const item of items) {
      const itemDate = new Date(item.date);
      if (item.recurrence === 'one-time') {
        if (itemDate.getFullYear() === year && itemDate.getMonth() === month) {
          results.push(item);
        }
      } else if (item.recurrence === 'monthly') {
        if (itemDate <= monthEnd) {
          results.push({ ...item, date: new Date(year, month, itemDate.getDate()).toISOString().slice(0, 10) });
        }
      } else if (item.recurrence === 'weekly') {
        if (itemDate <= monthEnd) {
          let d = new Date(itemDate);
          while (d <= monthEnd) {
            if (d >= monthStart) results.push({ ...item, date: d.toISOString().slice(0, 10) });
            d = new Date(d.getTime() + 7 * 86400000);
          }
        }
      } else if (item.recurrence === 'biweekly') {
        if (itemDate <= monthEnd) {
          let d = new Date(itemDate);
          while (d <= monthEnd) {
            if (d >= monthStart) results.push({ ...item, date: d.toISOString().slice(0, 10) });
            d = new Date(d.getTime() + 14 * 86400000);
          }
        }
      }
    }
    return results;
  }

  const thisMonthExpanded = expandThisMonth(income);
  const thisMonthTotal = thisMonthExpanded.reduce((s, i) => s + i.amount, 0);

  const filtered = categoryFilter === 'all' ? income : income.filter(i => i.category === categoryFilter);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ source: item.source, amount: item.amount, date: item.date, recurrence: item.recurrence, category: item.category, notes: item.notes || '' });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, amount: parseFloat(form.amount) };
    if (editing) {
      await put(`/income/${editing.id}`, payload);
    } else {
      await post('/income', payload);
    }
    setShowModal(false);
    fetchIncome();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this income entry?')) return;
    await del(`/income/${id}`);
    fetchIncome();
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">Income</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Income</button>
      </div>

      {/* Summary Card */}
      <div className="card-grid" style={{ gridTemplateColumns: '1fr', maxWidth: 320, marginBottom: 24 }}>
        <div className="summary-card">
          <div className="card-label">This Month</div>
          <div className="card-value">{fmt(thisMonthTotal)}</div>
          <div className="card-sub">{thisMonthExpanded.length} entries (incl. recurring)</div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`btn btn-sm ${categoryFilter === cat ? 'btn-primary' : 'btn-ghost'}`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Income List */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💵</div>
            <div className="empty-state-text">No income entries yet</div>
            <button className="btn btn-primary" onClick={openAdd}>Add Income</button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Recurrence</th>
                  <th>Category</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.source}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(item.amount)}</td>
                    <td>{item.date}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.recurrence}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.category}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{item.notes || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(item)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Delete</button>
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
            <div className="modal-title">{editing ? 'Edit Income' : 'Add Income'}</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Source</label>
                <input className="form-input" required value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="e.g. Salary, Freelance Project" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount ($)</label>
                  <input className="form-input" type="number" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Recurrence</label>
                  <select className="form-select" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                    {RECURRENCES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Add Income'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
