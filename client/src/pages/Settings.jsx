import React, { useEffect, useState } from 'react';
import { get, post, put } from '../api.js';

export default function Settings() {
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestResult, setDigestResult] = useState(null);

  useEffect(() => {
    get('/settings/smtp-status').then(data => setSmtpStatus(data));
    get('/user-settings').then(s => setDigestEnabled(s.weekly_digest !== '0'));
  }, []);

  async function sendTestReminder() {
    setSending(true);
    setTestResult(null);
    try {
      const result = await post('/settings/test-reminder', {});
      setTestResult({ ok: true, message: result.message || 'Test reminder sent!' });
    } catch (err) {
      setTestResult({ ok: false, message: 'Failed to send test reminder.' });
    }
    setSending(false);
  }

  async function toggleDigest() {
    const next = !digestEnabled;
    setDigestEnabled(next);
    await put('/user-settings', { key: 'weekly_digest', value: next ? '1' : '0' });
  }

  async function sendTestDigest() {
    setSendingDigest(true);
    setDigestResult(null);
    try {
      const result = await post('/settings/test-digest', {});
      if (result.error) setDigestResult({ ok: false, message: result.error });
      else setDigestResult({ ok: true, message: result.message || 'Test digest sent!' });
    } catch (err) {
      setDigestResult({ ok: false, message: 'Failed to send test digest.' });
    }
    setSendingDigest(false);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">Settings</div>
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 16 }}>Email Reminders</div>
        <div className="card">
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>SMTP Configuration</div>
            {smtpStatus === null ? (
              <div style={{ color: 'var(--text-muted)' }}>Checking...</div>
            ) : smtpStatus.configured ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--success)', fontSize: 18 }}>✓</span>
                <span style={{ color: 'var(--success)' }}>SMTP is configured. Reminders are active.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--danger)', fontSize: 18 }}>✗</span>
                <span style={{ color: 'var(--danger)' }}>SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM environment variables to enable reminders.</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Test Reminder</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>
              Send an immediate reminder email to your account for upcoming bills and split payments due in the next 3 days.
            </div>
            <button
              className="btn btn-primary"
              onClick={sendTestReminder}
              disabled={sending || (smtpStatus && !smtpStatus.configured)}
            >
              {sending ? 'Sending...' : 'Send Test Reminder'}
            </button>
            {testResult && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: testResult.ok ? 'var(--success-light)' : 'var(--danger-light)',
                color: testResult.ok ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                fontSize: 14
              }}>
                {testResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 16 }}>Weekly Spending Digest</div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div
                onClick={toggleDigest}
                style={{
                  width: 48, height: 26, borderRadius: 13,
                  background: digestEnabled ? 'var(--accent)' : 'var(--border)',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: digestEnabled ? 25 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ fontWeight: 500 }}>Weekly digest {digestEnabled ? 'enabled' : 'disabled'}</span>
            </label>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>
            Every Sunday: total spent last week, top categories and payees, and split payment installments due in the coming week.
          </div>
          <button
            className="btn btn-primary"
            onClick={sendTestDigest}
            disabled={sendingDigest || (smtpStatus && !smtpStatus.configured)}
          >
            {sendingDigest ? 'Sending...' : 'Send Test Digest'}
          </button>
          {digestResult && (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: digestResult.ok ? 'var(--success-light)' : 'var(--danger-light)',
              color: digestResult.ok ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${digestResult.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              fontSize: 14
            }}>
              {digestResult.message}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 16 }}>How Reminders Work</div>
        <div className="card" style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 2 }}>
          <ul style={{ paddingLeft: 20 }}>
            <li>Reminders run automatically every 24 hours</li>
            <li>Bills due in 3 days are included (monthly bills by due day, one-time bills by due date)</li>
            <li>Unpaid split payment installments due in 3 days are included</li>
            <li>If there are no upcoming payments, no email is sent (unless it's a test)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
