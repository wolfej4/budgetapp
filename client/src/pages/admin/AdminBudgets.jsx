import React, { useEffect, useState } from 'react';
import { get, del } from '../../api.js';

export default function AdminBudgets() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    get('/admin/budgets').then(data => {
      if (Array.isArray(data)) setBudgets(data);
      else setError(data.error || 'Failed to load budgets');
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (budget) => {
    if (!window.confirm(`Delete budget "${budget.name}"? This cannot be undone.`)) return;
    await del(`/admin/budgets/${budget.id}`);
    load();
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Budgets</h2>
      {error && <div className="error-msg">{error}</div>}
      {loading ? <p>Loading...</p> : (
        <div className="card" style={{ overflowX: 'auto' }}>
          {budgets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📂</div>
              <div className="empty-state-text">No budgets found.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Members</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map(budget => (
                  <tr key={budget.id}>
                    <td>{budget.name}</td>
                    <td>
                      <div>{budget.owner_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{budget.owner_email}</div>
                    </td>
                    <td>{budget.member_count}</td>
                    <td>{budget.created_at ? new Date(budget.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(budget)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
