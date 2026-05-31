import React, { useEffect, useState } from 'react';
import { get } from '../api.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PIE_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#0ea5e9','#ec4899','#14b8a6','#a855f7'];

export default function Reports() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get(`/reports/monthly?year=${year}&month=${month}`).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const token = localStorage.getItem('token');
  const csvBase = `/api/export/csv?token=${token}`;
  const pdfUrl = `/api/export/pdf?year=${year}&month=${month}&token=${token}`;

  if (loading || !data) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  const totalExpenses = (data.bills?.total || 0) + (data.splitPayments?.total || 0) + (data.loans?.total || 0);
  const prevExpenses = (data.previousMonth?.bills?.total || 0) + (data.previousMonth?.splitPayments?.total || 0) + (data.previousMonth?.loans?.total || 0);

  const barData = [
    {
      name: MONTHS[month - 1].slice(0, 3),
      Income: data.income?.total || 0,
      Expenses: totalExpenses,
    },
    {
      name: month === 1 ? `Dec ${year - 1}` : MONTHS[month - 2].slice(0, 3),
      Income: data.previousMonth?.income?.total || 0,
      Expenses: prevExpenses,
    }
  ];

  // Expense breakdown pie
  const expenseCats = {};
  for (const [cat, val] of Object.entries(data.bills?.byCategory || {})) {
    expenseCats[cat] = (expenseCats[cat] || 0) + val;
  }
  for (const [name, val] of Object.entries(data.loans?.byName || {})) {
    expenseCats[`Loan: ${name}`] = (expenseCats[`Loan: ${name}`] || 0) + val;
  }
  if (data.splitPayments?.total) expenseCats['Split Payments'] = data.splitPayments.total;

  const pieData = Object.entries(expenseCats).map(([name, value]) => ({ name, value }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">Monthly Reports</div>
      </div>

      {/* Month Picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={prevMonth}>← Prev</button>
        <span style={{ fontSize: 20, fontWeight: 700, minWidth: 180, textAlign: 'center' }}>
          {MONTHS[month - 1]} {year}
        </span>
        <button className="btn btn-ghost" onClick={nextMonth}>Next →</button>
      </div>

      {/* Summary Cards */}
      <div className="card-grid" style={{ marginBottom: 24 }}>
        <div className="summary-card">
          <div className="card-label">Income</div>
          <div className="card-value" style={{ color: 'var(--success)' }}>{fmt(data.income?.total)}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Bills</div>
          <div className="card-value">{fmt(data.bills?.total)}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Split Payments</div>
          <div className="card-value">{fmt(data.splitPayments?.total)}</div>
          <div className="card-sub">{fmt(data.splitPayments?.paid)} paid, {fmt(data.splitPayments?.due)} due</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Loan Payments</div>
          <div className="card-value">{fmt(data.loans?.total)}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Net Cash Flow</div>
          <div className="card-value" style={{ color: (data.net || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {(data.net || 0) >= 0 ? '+' : ''}{fmt(data.net)}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="reports-charts" style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 280 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Income vs Expenses</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 13 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={v => '$' + v} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {pieData.length > 0 && (
          <div className="card" style={{ flex: 1, minWidth: 280 }}>
            <div className="section-title" style={{ marginBottom: 16 }}>Expense Breakdown</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Income by Category */}
      {data.income?.byCategory && Object.keys(data.income.byCategory).length > 0 && (
        <div className="section">
          <div className="section-title" style={{ marginBottom: 12 }}>Income by Category</div>
          <div className="card">
            <div className="table-container">
              <table>
                <thead><tr><th>Category</th><th>Amount</th></tr></thead>
                <tbody>
                  {Object.entries(data.income.byCategory).map(([cat, amt]) => (
                    <tr key={cat}><td style={{ textTransform: 'capitalize' }}>{cat}</td><td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(amt)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Export */}
      <div className="section">
        <div className="section-title" style={{ marginBottom: 12 }}>Export</div>
        <div className="export-buttons" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="btn btn-ghost" href={`${csvBase}&type=bills`} download>⬇ Bills CSV</a>
          <a className="btn btn-ghost" href={`${csvBase}&type=income`} download>⬇ Income CSV</a>
          <a className="btn btn-ghost" href={`${csvBase}&type=loans`} download>⬇ Loans CSV</a>
          <a className="btn btn-ghost" href={`${csvBase}&type=split-payments`} download>⬇ Split Payments CSV</a>
          <a className="btn btn-primary" href={pdfUrl} download>⬇ Monthly PDF Report</a>
        </div>
      </div>
    </div>
  );
}
