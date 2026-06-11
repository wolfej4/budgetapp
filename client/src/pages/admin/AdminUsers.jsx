import React, { useEffect, useState } from 'react';
import { get, put, del, post } from '../../api.js';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  // Invites
  const [invites, setInvites] = useState([]);
  const [inviteDays, setInviteDays] = useState('7');
  const [newInviteUrl, setNewInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const impersonating = !!localStorage.getItem('impersonating');

  const load = () => {
    setLoading(true);
    Promise.all([get('/admin/users'), get('/admin/invites')]).then(([userData, inviteData]) => {
      if (Array.isArray(userData)) setUsers(userData);
      else setError(userData.error || 'Failed to load users');
      if (Array.isArray(inviteData)) setInvites(inviteData);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleRoleToggle = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    await put(`/admin/users/${user.id}/role`, { role: newRole });
    load();
  };

  const handleDisableToggle = async (user) => {
    await put(`/admin/users/${user.id}/disable`, {});
    load();
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.name}" and all their data? This cannot be undone.`)) return;
    await del(`/admin/users/${user.id}`);
    load();
  };

  const handleImpersonate = async (user) => {
    const data = await post(`/admin/users/${user.id}/impersonate`, {});
    if (data.token) {
      localStorage.setItem('impersonateToken', data.token);
      localStorage.setItem('impersonating', JSON.stringify({ id: user.id, name: user.name }));
      window.location.href = '/dashboard';
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) return;
    const data = await post(`/admin/users/${resetModal.id}/reset-password`, { newPassword });
    if (data.success) {
      setResetMsg('Password reset successfully.');
      setNewPassword('');
      setTimeout(() => { setResetModal(null); setResetMsg(''); }, 1500);
    } else {
      setResetMsg(data.error || 'Failed to reset password');
    }
  };

  const handleStopImpersonating = () => {
    localStorage.removeItem('impersonateToken');
    localStorage.removeItem('impersonating');
    window.location.reload();
  };

  const handleCreateInvite = async () => {
    const data = await post('/admin/invites', { expiresInDays: inviteDays ? Number(inviteDays) : null });
    if (data.token) {
      const url = `${window.location.origin}/register?invite=${data.token}`;
      setNewInviteUrl(url);
      load();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newInviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRevokeInvite = async (id) => {
    await del(`/admin/invites/${id}`);
    load();
    if (newInviteUrl) setNewInviteUrl('');
  };

  const impersonatingData = impersonating ? JSON.parse(localStorage.getItem('impersonating') || 'null') : null;

  const pendingInvites = invites.filter(i => !i.used_at);
  const usedInvites = invites.filter(i => i.used_at);

  return (
    <div>
      {impersonatingData && (
        <div className="impersonation-banner">
          Impersonating: <strong>{impersonatingData.name}</strong>
          <button className="btn btn-sm" onClick={handleStopImpersonating} style={{ marginLeft: 16 }}>Stop Impersonating</button>
        </div>
      )}
      <h2 style={{ marginBottom: 20 }}>Users</h2>
      {error && <div className="error-msg">{error}</div>}
      {loading ? <p>Loading...</p> : (
        <div className="card" style={{ overflowX: 'auto', marginBottom: 32 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Bills</th>
                <th>Loans</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={user.role === 'admin' ? 'badge badge-admin' : 'badge badge-user'}>
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td>
                    <span className={user.disabled ? 'badge badge-disabled' : 'badge badge-active'}>
                      {user.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</td>
                  <td>{user.bill_count}</td>
                  <td>{user.loan_count}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {user.id !== currentUser.id && (
                        <>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleRoleToggle(user)}>
                            {user.role === 'admin' ? 'Make User' : 'Make Admin'}
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleDisableToggle(user)}>
                            {user.disabled ? 'Enable' : 'Disable'}
                          </button>
                        </>
                      )}
                      <button className="btn btn-sm btn-ghost" onClick={() => { setResetModal(user); setNewPassword(''); setResetMsg(''); }}>
                        Reset PW
                      </button>
                      {user.id !== currentUser.id && (
                        <>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleImpersonate(user)}>
                            Impersonate
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(user)}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Links */}
      <h2 style={{ marginBottom: 16 }}>Invite Links</h2>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Generate a new invite link</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <select
            className="form-select"
            value={inviteDays}
            onChange={e => setInviteDays(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="1">Expires in 1 day</option>
            <option value="3">Expires in 3 days</option>
            <option value="7">Expires in 7 days</option>
            <option value="30">Expires in 30 days</option>
            <option value="">Never expires</option>
          </select>
          <button className="btn btn-primary" onClick={handleCreateInvite}>Generate Link</button>
        </div>
        {newInviteUrl && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="form-input"
              readOnly
              value={newInviteUrl}
              style={{ flex: 1, minWidth: 200, fontFamily: 'monospace', fontSize: 13 }}
              onFocus={e => e.target.select()}
            />
            <button className="btn btn-ghost" onClick={handleCopy}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {pendingInvites.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Active Invites</div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Created by</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map(inv => (
                <tr key={inv.id}>
                  <td>{inv.created_by_name}</td>
                  <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td>{inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : 'Never'}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => handleRevokeInvite(inv.id)}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {usedInvites.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Used Invites</div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Created by</th>
                <th>Used by</th>
                <th>Used on</th>
              </tr>
            </thead>
            <tbody>
              {usedInvites.map(inv => (
                <tr key={inv.id}>
                  <td>{inv.created_by_name}</td>
                  <td>{inv.used_by_name || '—'}</td>
                  <td>{inv.used_at ? new Date(inv.used_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetModal && (
        <div className="modal-overlay" onClick={() => setResetModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Reset Password for {resetModal.name}</h3>
            <input
              className="input"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              style={{ marginBottom: 12, width: '100%' }}
            />
            {resetMsg && <p style={{ marginBottom: 12, color: resetMsg.includes('success') ? 'var(--success)' : 'var(--danger)' }}>{resetMsg}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleResetPassword}>Reset</button>
              <button className="btn btn-ghost" onClick={() => setResetModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
