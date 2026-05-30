import React, { useEffect, useState } from 'react';
import { get } from '../api.js';

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Dashboard() {
  const [bills, setBills] = useState([]);
  const [splits, setSplits] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    Promise.all([get('/bills'), get('/split-payments'), get('/loans')]).then(([b, s, l]) => {
      setBills(Array.isArray(b) ? b : []);
      setSplits(Array.isArray(s) ? s : []);
      setLoans(Array.isArray(l) ? l : []);
      setLoading(false);
    });
  }, []);

  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const totalMonthlyBills = bills
    .filter(b => b.recurrence === 'monthly')
    .reduce((sum, b) => sum + b.amount, 0);

  const totalSplitRemaining = splits.reduce((sum, sp) => {
    const unpaid = (sp.installments || []).filter(i => !i.paid).reduce((s, i) => s + i.amount, 0);
    return sum + unpaid;
  }, 0);

  const totalLoanBalance = loans.reduce((sum, l) => sum + l.current_balance, 0);

  // Upcoming: bills due in next 10 days + split installments due in next 10 days
  const upcoming = [];

  bills.forEach(bill => {
    let dueDay = null;
    if (bill.recurrence === 'monthly') {
      dueDay = bill.due_day;
    } else if (bill.recurrence === 'yearly') {
      const d = bill.due_date ? new Date(bill.due_date) : null;
      if (d && d.getMonth() === currentMonth) dueDay = d.getDate();
    } else if (bill.recurrence === 'one-time') {
      const d = bill.due_date ? new Date(bill.due_date) : null;
      if (d && d.getFullYear() === currentYear && d.getMonth() === currentMonth) dueDay = d.getDate();
    }
    if (dueDay !== null && dueDay >= currentDay && dueDay <= currentDay + 14) {
      upcoming.push({ type: 'bill', name: bill.name, amount: bill.amount, day: dueDay, category: bill.category });
    }
  });

  splits.forEach(sp => {
    (sp.installments || []).forEach(inst => {
      if (!inst.paid) {
        const d = new Date(inst.due_date);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          const day = d.getDate();
          if (day >= currentDay && day <= currentDay + 14) {
            upcoming.push({ type: 'split', name: sp.description, amount: inst.amount, day, provider: sp.provider });
          }
        }
      }
    });
  });

  upcoming.sort((a, b) => a.day - b.day);

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="text-muted" style={{ marginTop: 4, fontSize: 14 }}>
            Welcome back, {user.name || 'there'}!
          </div>
        </div>
      </div>

      <div className="card-grid">
        <div className="summary-card">
          <div className="card-label">Monthly Bills</div>
          <div className="card-value">{fmt(totalMonthlyBills)}</div>
          <div className="card-sub">{bills.filter(b => b.recurrence === 'monthly').length} recurring bills</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Split Pay Remaining</div>
          <div className="card-value">{fmt(totalSplitRemaining)}</div>
          <div className="card-sub">{splits.length} active plans</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Total Loan Balance</div>
          <div className="card-value">{fmt(totalLoanBalance)}</div>
          <div className="card-sub">{loans.length} active loans</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Total Monthly Outgoing</div>
          <div className="card-value">{fmt(totalMonthlyBills + loans.reduce((s, l) => s + l.monthly_payment, 0))}</div>
          <div className="card-sub">Bills + loan payments</div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">Upcoming This Month</div>
          <div className="text-muted" style={{ fontSize: 13 }}>Next 14 days</div>
        </div>
        {upcoming.length === 0 ? (
          <div className="card">
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No upcoming payments in the next 14 days
            </div>
          </div>
        ) : (
          <div className="upcoming-list">
            {upcoming.map((item, i) => (
              <div className="upcoming-item" key={i}>
                <div className="item-day">{item.day}</div>
                <div className="item-info">
                  <div className="item-name">{item.name}</div>
                  <div className="item-meta">
                    {item.type === 'bill' ? (item.category || 'Bill') : `Split Pay — ${item.provider}`}
                  </div>
                </div>
                <div className="item-amount">{fmt(item.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loans.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-title">Loans Overview</div>
          </div>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Balance</th>
                    <th>Rate</th>
                    <th>Monthly Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map(loan => (
                    <tr key={loan.id}>
                      <td>{loan.name}</td>
                      <td>{fmt(loan.current_balance)}</td>
                      <td>{loan.interest_rate}%</td>
                      <td>{fmt(loan.monthly_payment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
