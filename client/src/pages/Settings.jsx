import React, { useEffect, useState } from 'react';
import { get, post } from '../api.js';

export default function Settings() {
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    get('/settings/smtp-status').then(data => setSmtpStatus(data));
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
