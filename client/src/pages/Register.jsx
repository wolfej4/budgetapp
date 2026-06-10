import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { post } from '../api.js';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form };
      if (inviteToken) payload.invite_token = inviteToken;
      const data = await post('/auth/register', payload);
      if (data.error) {
        setError(data.error);
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-title">Create account</div>
        <div className="auth-subtitle">
          {inviteToken ? "You've been invited to BudgetBuddy!" : 'Start tracking your budget today'}
        </div>
        {inviteToken && (
          <div style={{ background: 'var(--success-light)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 14, marginBottom: 16 }}>
            Invite link active — fill in your details to get started.
          </div>
        )}
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              className="form-input"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Your full name"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '15px' }}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <Link to="/login" className="auth-link">Already have an account? Sign in</Link>
      </div>
    </div>
  );
}
