import React, { useEffect, useState } from 'react';
import { get, put, post } from '../../api.js';

const SMTP_FIELDS = [
  { key: 'smtp_host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.example.com' },
  { key: 'smtp_port', label: 'SMTP Port', type: 'text', placeholder: '587' },
  { key: 'smtp_user', label: 'SMTP User', type: 'text', placeholder: 'user@example.com' },
  { key: 'smtp_pass', label: 'SMTP Password', type: 'password', placeholder: '••••••••' },
  { key: 'smtp_from', label: 'From Address', type: 'text', placeholder: 'noreply@example.com' },
];

const OIDC_FIELDS = [
  { key: 'oidc_issuer', label: 'Issuer URL', type: 'text', placeholder: 'https://accounts.google.com' },
  { key: 'oidc_client_id', label: 'Client ID', type: 'text', placeholder: 'your-client-id' },
  { key: 'oidc_client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••' },
  { key: 'oidc_redirect_uri', label: 'Redirect URI (optional)', type: 'text', placeholder: 'https://yourapp.com/api/auth/oidc/callback' },
  { key: 'oidc_provider_name', label: 'Button Label', type: 'text', placeholder: 'e.g. Google' },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [smtpValues, setSmtpValues] = useState({});
  const [oidcValues, setOidcValues] = useState({});
  const [testMsg, setTestMsg] = useState('');

  const load = () => {
    setLoading(true);
    get('/admin/settings').then(data => {
      setSettings(data);
      const smtp = {};
      for (const f of SMTP_FIELDS) smtp[f.key] = data[f.key] || '';
      setSmtpValues(smtp);
      const oidc = {};
      for (const f of OIDC_FIELDS) oidc[f.key] = data[f.key] || '';
      setOidcValues(oidc);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleRegToggle = async () => {
    const newVal = settings.registration_open === '1' ? '0' : '1';
    await put('/admin/settings', { key: 'registration_open', value: newVal });
    setSettings(s => ({ ...s, registration_open: newVal }));
    setMsg('Setting saved.');
    setTimeout(() => setMsg(''), 2000);
  };

  const handleSmtpSave = async () => {
    setSaving(true);
    setMsg('');
    for (const f of SMTP_FIELDS) {
      await put('/admin/settings', { key: f.key, value: smtpValues[f.key] || '' });
    }
    setSaving(false);
    setMsg('SMTP settings saved.');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleOidcSave = async () => {
    setSaving(true);
    setMsg('');
    for (const f of OIDC_FIELDS) {
      await put('/admin/settings', { key: f.key, value: oidcValues[f.key] || '' });
    }
    setSaving(false);
    setMsg('OIDC settings saved.');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleTestEmail = async () => {
    setTestMsg('Sending...');
    const data = await post('/settings/test-reminder', {});
    if (data.success || data.message) {
      setTestMsg('Test email sent successfully.');
    } else {
      setTestMsg(data.error || 'Failed to send test email.');
    }
    setTimeout(() => setTestMsg(''), 4000);
  };

  if (loading) return <p>Loading...</p>;

  const regOpen = settings.registration_open !== '0';

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>App Settings</h2>

      {msg && <div className="error-msg" style={{ background: 'var(--success-light)', color: 'var(--success)', borderColor: 'rgba(34,197,94,0.3)', marginBottom: 16 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Registration</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div
              onClick={handleRegToggle}
              style={{
                width: 48, height: 26, borderRadius: 13,
                background: regOpen ? 'var(--accent)' : 'var(--border)',
                position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: regOpen ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ fontWeight: 500 }}>Registration {regOpen ? 'Open' : 'Closed'}</span>
          </label>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {regOpen ? 'New users can register.' : 'Registration is disabled — only existing users can log in.'}
          </span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 8 }}>SMTP Configuration</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Environment variables (SMTP_HOST, SMTP_PORT, etc.) take precedence over these DB settings.
          These values are used as fallback when env vars are not set.
        </p>
        {SMTP_FIELDS.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}</label>
            <input
              className="form-input"
              type={f.type}
              placeholder={f.placeholder}
              value={smtpValues[f.key] || ''}
              onChange={e => setSmtpValues(v => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleSmtpSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save SMTP Settings'}
          </button>
          <button className="btn btn-ghost" onClick={handleTestEmail}>Send Test Email</button>
          {testMsg && <span style={{ fontSize: 13, color: testMsg.includes('success') ? 'var(--success)' : 'var(--danger)' }}>{testMsg}</span>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Single Sign-On (OIDC)</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Let users sign in with an OpenID Connect provider (Google, Keycloak, Authentik, Auth0...).
          Register this redirect URI with your provider: <code>{window.location.origin}/api/auth/oidc/callback</code>.
          Environment variables (OIDC_ISSUER, OIDC_CLIENT_ID, ...) take precedence over these settings.
          A "Continue with ..." button appears on the login page once issuer, client ID, and secret are set.
        </p>
        {OIDC_FIELDS.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}</label>
            <input
              className="form-input"
              type={f.type}
              placeholder={f.placeholder}
              value={oidcValues[f.key] || ''}
              onChange={e => setOidcValues(v => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <button className="btn btn-primary" onClick={handleOidcSave} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? 'Saving...' : 'Save OIDC Settings'}
        </button>
      </div>
    </div>
  );
}
