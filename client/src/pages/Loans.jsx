import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { get, post, put, del } from '../api.js';

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CATEGORIES = ['Auto', 'Home', 'Student', 'Personal', 'Medical', 'Business', 'Other'];

const EMPTY_FORM = {
  name: '', original_amount: '', current_balance: '', interest_rate: '',
  monthly_payment: '', start_date: '', category: 'auto'
};

function LoanDetail({ loan, onClose }) {
  const [schedule, setSchedule] = useState(null);
  const [simSchedule, setSimSchedule] = useState(null);
  const [extraPayment, setExtraPayment] = useState('');
  const [monthsSaved, setMonthsSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    get(`/loans/${loan.id}/amortization`).then(data => {
      setSchedule(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [loan.id]);

  const runSimulator = async () => {
    if (!extraPayment || parseFloat(extraPayment) <= 0) return;
    setSimLoading(true);
    const data = await get(`/loans/${loan.id}/simulate?extraPayment=${extraPayment}`);
    if (data.accelerated) {
      setSimSchedule(data.accelerated);
      setMonthsSaved(data.monthsSaved);
    }
    setSimLoading(false);
  };

  // Merge base + sim for chart — sample every N months to keep chart readable
  const chartData = (() => {
    if (!schedule) return [];
    const base = schedule;
    const accel = simSchedule;
    const maxLen = Math.max(base.length, accel ? accel.length : 0);
    const step = Math.max(1, Math.floor(maxLen / 60));
    const result = [];
    for (let i = 0; i < base.length; i += step) {
      const entry = { month: base[i].month, balance: base[i].balance };
      if (accel && i < accel.length) entry.accelerated = accel[i].balance;
      result.push(entry);
    }
    // Ensure last points
    if (base.length > 0) {
      const last = base[base.length - 1];
      result.push({ month: last.month, balance: 0 });
      if (accel && accel.length > 0) {
        // Add accelerated end
        const lastA = accel[accel.length - 1];
        if (!result.find(r => r.month === lastA.month)) {
          result.push({ month: lastA.month, accelerated: 0 });
        }
      }
    }
    return result;
  })();

  return (
    <div className="loan-card-body">
      <div className="loan-stats">
        <div className="loan-stat">
          <div className="loan-stat-value">{fmt(loan.current_balance)}</div>
          <div className="loan-stat-label">Balance</div>
        </div>
        <div className="loan-stat">
          <div className="loan-stat-value">{loan.interest_rate}%</div>
          <div className="loan-stat-label">Annual Rate</div>
        </div>
        <div className="loan-stat">
          <div className="loan-stat-value">{fmt(loan.monthly_payment)}</div>
          <div className="loan-stat-label">Monthly Payment</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading amortization...</div>
      ) : (
        <>
          <div style={{ marginTop: 24, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Payoff Timeline</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              {schedule.length} months to pay off ({Math.floor(schedule.length / 12)}y {schedule.length % 12}m)
            </div>
          </div>

          <div className="simulator-row">
            <input
              className="form-input"
              type="number"
              min="0"
              step="10"
              value={extraPayment}
              onChange={e => setExtraPayment(e.target.value)}
              placeholder="Extra monthly payment ($)"
              style={{ maxWidth: 220 }}
            />
            <button className="btn btn-primary btn-sm" onClick={runSimulator} disabled={simLoading}>
              {simLoading ? 'Simulating...' : 'Simulate'}
            </button>
            {simSchedule && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSimSchedule(null); setMonthsSaved(null); setExtraPayment(''); }}>
                Clear
              </button>
            )}
          </div>

          {monthsSaved !== null && (
            <div className="payoff-comparison">
              {monthsSaved > 0
                ? `Pay off ${monthsSaved} month${monthsSaved !== 1 ? 's' : ''} sooner with an extra ${fmt(parseFloat(extraPayment))}/mo!`
                : `No time saved — payment may already cover the loan quickly.`}
            </div>
          )}

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--text-dim)" tick={{ fontSize: 11 }} label={{ value: 'Month', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis stroke="var(--text-dim)" tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                formatter={(v, name) => [fmt(v), name === 'balance' ? 'Standard' : 'Accelerated']}
                labelFormatter={l => `Month ${l}`}
              />
              <Legend formatter={v => v === 'balance' ? 'Standard Payoff' : 'Accelerated Payoff'} />
              <Line type="monotone" dataKey="balance" stroke="var(--accent)" dot={false} strokeWidth={2} />
              {simSchedule && (
                <Line type="monotone" dataKey="accelerated" stroke="var(--success)" dot={false} strokeWidth={2} strokeDasharray="6 3" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editLoan, setEditLoan] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    get('/loans').then(data => {
      setLoans(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditLoan(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (loan, e) => {
    e.stopPropagation();
    setEditLoan(loan);
    setForm({
      name: loan.name,
      original_amount: String(loan.original_amount),
      current_balance: String(loan.current_balance),
      interest_rate: String(loan.interest_rate),
      monthly_payment: String(loan.monthly_payment),
      start_date: loan.start_date,
      category: loan.category || 'auto'
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this loan?')) return;
    await del(`/loans/${id}`);
    if (expandedId === id) setExpandedId(null);
    load();
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      name: form.name,
      original_amount: parseFloat(form.original_amount),
      current_balance: parseFloat(form.current_balance),
      interest_rate: parseFloat(form.interest_rate),
      monthly_payment: parseFloat(form.monthly_payment),
      start_date: form.start_date,
      category: form.category
    };
    try {
      let data;
      if (editLoan) {
        data = await put(`/loans/${editLoan.id}`, payload);
      } else {
        data = await post('/loans', payload);
      }
      if (data.error) { setError(data.error); return; }
      setShowModal(false);
      load();
    } catch {
      setError('Failed to save loan.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Loans</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Loan</button>
      </div>

      {loans.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <div className="empty-state-text">No loans tracked yet. Add your first loan!</div>
          </div>
        </div>
      ) : (
        loans.map(loan => (
          <div className="loan-card" key={loan.id}>
            <div className="loan-card-header" onClick={() => setExpandedId(expandedId === loan.id ? null : loan.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{loan.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>{loan.category}</div>
              </div>
              <div style={{ textAlign: 'right', marginRight: 16 }}>
                <div style={{ fontWeight: 700 }}>{fmt(loan.current_balance)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loan.interest_rate}% APR</div>
              </div>
              <div className="flex-gap">
                <button className="btn btn-ghost btn-sm" onClick={(e) => openEdit(loan, e)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(loan.id, e)}>Delete</button>
                <span style={{ color: 'var(--text-muted)', fontSize: 18, marginLeft: 4 }}>
                  {expandedId === loan.id ? '▲' : '▼'}
                </span>
              </div>
            </div>
            {expandedId === loan.id && <LoanDetail loan={loan} />}
          </div>
        ))
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editLoan ? 'Edit Loan' : 'Add Loan'}</div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Loan Name</label>
                <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Car Loan" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Original Amount ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0" required value={form.original_amount} onChange={e => setForm({...form, original_amount: e.target.value})} placeholder="20000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Current Balance ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0" required value={form.current_balance} onChange={e => setForm({...form, current_balance: e.target.value})} placeholder="15000" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Interest Rate (% annual)</label>
                  <input className="form-input" type="number" step="0.01" min="0" required value={form.interest_rate} onChange={e => setForm({...form, interest_rate: e.target.value})} placeholder="6.5" />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Payment ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0" required value={form.monthly_payment} onChange={e => setForm({...form, monthly_payment: e.target.value})} placeholder="350" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input className="form-input" type="date" required value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editLoan ? 'Update' : 'Add Loan')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
