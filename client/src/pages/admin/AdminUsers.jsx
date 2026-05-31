import React, { useEffect, useState } from 'react';
import { get, put, del, post } from '../../api.js';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetModal, setResetModal] = useState(null); // { id, name }
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const impersonating = !!localStorage.getItem('impersonating');

  const load = () => {
    setLoading(true);
    get('/admin/users').then(data => {
      if (Array.isArray(data)) setUsers(data);
      else setError(data.error || 'Failed to load users');
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

  const impersonatingData = impersonating ? JSON.parse(localStorage.getItem('impersonating') || 'null') : null;

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
        <div className="card" style={{ overflowX: 'auto' }}>
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
