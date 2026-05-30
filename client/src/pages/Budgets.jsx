import React, { useEffect, useState } from 'react';
import { get, post, del } from '../api.js';

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(null);
  const [newBudgetName, setNewBudgetName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const load = () => {
    get('/budgets').then(data => {
      setBudgets(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!newBudgetName.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const data = await post('/budgets', { name: newBudgetName });
      if (data.error) { setError(data.error); return; }
      setShowCreateModal(false);
      setNewBudgetName('');
      load();
    } catch {
      setError('Failed to create budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteEmail.trim()) { setInviteError('Email is required'); return; }
    setSaving(true);
    try {
      const data = await post(`/budgets/${showInviteModal}/invite`, { email: inviteEmail, role: inviteRole });
      if (data.error) { setInviteError(data.error); return; }
      setInviteSuccess('User invited successfully!');
      setInviteEmail('');
      load();
    } catch {
      setInviteError('Failed to invite user.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (budgetId, userId) => {
    if (!window.confirm('Remove this member?')) return;
    const data = await del(`/budgets/${budgetId}/members/${userId}`);
    if (data.error) { alert(data.error); return; }
    load();
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Shared Budgets</div>
        <button className="btn btn-primary" onClick={() => { setNewBudgetName(''); setError(''); setShowCreateModal(true); }}>
          + Create Budget
        </button>
      </div>

      {budgets.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-text">No budgets yet. Create one and invite others!</div>
          </div>
        </div>
      ) : (
        budgets.map(budget => {
          const isOwner = budget.owner_id === user.id;
          const isExpanded = expandedId === budget.id;
          return (
            <div className="card" key={budget.id} style={{ marginBottom: 16 }}>
              <div
                className="flex-between"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : budget.id)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 17 }}>{budget.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {(budget.members || []).length} member{(budget.members || []).length !== 1 ? 's' : ''} &bull; Your role: <span style={{ color: 'var(--accent)' }}>{budget.role}</span>
                  </div>
                </div>
                <div className="flex-gap">
                  {isOwner && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={e => { e.stopPropagation(); setInviteEmail(''); setInviteRole('viewer'); setInviteError(''); setInviteSuccess(''); setShowInviteModal(budget.id); }}
                    >
                      Invite Member
                    </button>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 16 }}>
                  <hr className="divider" style={{ margin: '12px 0' }} />
                  <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Members</div>
                  {(budget.members || []).map(member => (
                    <div className="member-row" key={member.id}>
                      <div className="member-avatar">{member.name.charAt(0).toUpperCase()}</div>
                      <div className="member-info">
                        <div className="member-name">{member.name} {member.id === user.id ? <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>(you)</span> : ''}</div>
                        <div className="member-email">{member.email}</div>
                      </div>
                      <span className="role-badge">{member.role}</span>
                      {isOwner && member.id !== user.id && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(budget.id, member.id)}>
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-title">Create Budget</div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Budget Name</label>
                <input
                  className="form-input"
                  required
                  autoFocus
                  value={newBudgetName}
                  onChange={e => setNewBudgetName(e.target.value)}
                  placeholder="e.g. Household Budget"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-title">Invite Member</div>
            {inviteError && <div className="error-msg">{inviteError}</div>}
            {inviteSuccess && (
              <div style={{ background: 'var(--success-light)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 14, marginBottom: 16 }}>
                {inviteSuccess}
              </div>
            )}
            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label className="form-label">User Email</label>
                <input
                  className="form-input"
                  type="email"
                  required
                  autoFocus
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="friend@example.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowInviteModal(null)}>Close</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Inviting...' : 'Invite'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
