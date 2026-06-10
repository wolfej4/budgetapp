import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oidc, setOidc] = useState({ enabled: false, providerName: 'SSO' });

  useEffect(() => {
    // Handle the OIDC callback redirect: /login#oidc_token=... or #oidc_error=...
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('oidc_token');
    const oidcError = hash.get('oidc_error');
    if (token) {
      window.history.replaceState(null, '', '/login');
      localStorage.setItem('token', token);
      get('/auth/me').then(user => {
        if (user && !user.error) {
          localStorage.setItem('user', JSON.stringify(user));
          navigate('/dashboard');
        } else {
          localStorage.removeItem('token');
          setError('Sign-in failed — please try again.');
        }
      });
      return;
    }
    if (oidcError) {
      window.history.replaceState(null, '', '/login');
      setError(oidcError);
    }
    get('/auth/oidc/status').then(s => {
      if (s && s.enabled) setOidc(s);
    }).catch(() => {});
  }, [navigate]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await post('/auth/login', form);
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
        <div className="auth-title">Welcome back</div>
        <div className="auth-subtitle">Sign in to your BudgetBuddy account</div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
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
              autoFocus
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
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '15px' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        {oidc.enabled && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <a
              className="btn btn-ghost"
              href="/api/auth/oidc/login"
              style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '15px' }}
            >
              Continue with {oidc.providerName}
            </a>
          </>
        )}
        <Link to="/register" className="auth-link">Don't have an account? Register</Link>
      </div>
    </div>
  );
}
