import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../api.js';

const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'cash', 'investment', 'other'];
const PRESET_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#0ea5e9','#ec4899','#14b8a6','#a855f7','#64748b'];
const EMPTY_FORM = { name: '', type: 'checking', color: '#6366f1' };

function fmt(n) {
  const abs = Math.abs(Number(n || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (Number(n) < 0 ? '-$' : '$') + abs;
}

const TYPE_LABELS = {
  checking: 'Checking', savings: 'Savings', credit: 'Credit Card',
  cash: 'Cash', investment: 'Investment', other: 'Other',
};

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    get('/accounts').then(data => {
      setAccounts(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditAccount(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (account) => {
    setEditAccount(account);
    setForm({ name: account.name, type: account.type, color: account.color });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = editAccount
        ? await put(`/accounts/${editAccount.id}`, form)
        : await post('/accounts', form);
      if (data.error) { setError(data.error); return; }
      setShowModal(false);
      load();
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this account? Transactions linked to it will be unassigned but not deleted.')) return;
    await del(`/accounts/${id}`);
    load();
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Accounts</div>
          <div className="text-muted" style={{ marginTop: 4, fontSize: 14 }}>
            Track balances across your bank accounts and cards
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Account</button>
      </div>

      {accounts.length > 0 && (
        <div className="summary-card" style={{ marginBottom: 24, maxWidth: 260 }}>
          <div className="card-label">Total Balance</div>
          <div className="card-value" style={{ color: totalBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmt(totalBalance)}
          </div>
          <div className="card-sub">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-text">No accounts yet. Add your first bank account or card to get started.</div>
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {accounts.map(account => (
            <div key={account.id} className="card" style={{ borderLeft: `4px solid ${account.color}`, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{account.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {TYPE_LABELS[account.type] || account.type}
                  </div>
                </div>
                <span
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: account.color, display: 'inline-block', marginTop: 3, flexShrink: 0
                  }}
                />
              </div>
              <div style={{
                fontSize: 22, fontWeight: 700, marginBottom: 16,
                color: account.balance >= 0 ? 'var(--success)' : 'var(--danger)'
              }}>
                {fmt(account.balance)}
              </div>
              <div className="flex-gap" style={{ flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate(`/transactions?account_id=${account.id}`)}
                >
                  View Transactions
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(account)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(account.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editAccount ? 'Edit Account' : 'Add Account'}</div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Account Name</label>
                <input
                  className="form-input"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Chase Checking, Savings, Amex"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Account Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                        cursor: 'pointer', outline: form.color === c ? '3px solid var(--text)' : '2px solid transparent',
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editAccount ? 'Update' : 'Add Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
