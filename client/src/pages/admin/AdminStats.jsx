import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { get } from '../../api.js';

export default function AdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get('/admin/stats').then(data => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!stats) return <p>Failed to load stats.</p>;

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, highlight: false },
    { label: 'New This Month', value: stats.newUsersThisMonth, highlight: true },
    { label: 'Total Bills', value: stats.totalBills, highlight: false },
    { label: 'Total Loans', value: stats.totalLoans, highlight: false },
    { label: 'Loan Volume', value: `$${Number(stats.totalLoanVolume).toLocaleString()}`, highlight: false },
    { label: 'Split Payments', value: stats.totalSplitPayments, highlight: false },
    { label: 'Transactions Logged', value: Number(stats.totalTransactions || 0).toLocaleString(), highlight: false },
    { label: 'Savings Goals', value: stats.totalSavingsGoals, highlight: false },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Stats</h2>
      <div className="stat-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {statCards.map(card => (
          <div key={card.label} className={`stat-card card${card.highlight ? ' stat-card-highlight' : ''}`}>
            <div className="stat-card-value">{card.value}</div>
            <div className="stat-card-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Signups by Month (Last 12 Months)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.signupsByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <Bar dataKey="count" name="Signups" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
