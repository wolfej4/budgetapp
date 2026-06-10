import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useTheme from '../hooks/useTheme.js';
import { get } from '../api.js';
import { readHiddenPages } from '../optionalPages.js';

export default function Navbar() {
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hiddenPages, setHiddenPages] = useState(readHiddenPages);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    // Authoritative copy lives in user settings so it follows the account
    get('/user-settings').then(s => {
      if (s && s.hidden_pages) {
        try {
          const hidden = JSON.parse(s.hidden_pages);
          setHiddenPages(hidden);
          localStorage.setItem('hiddenPages', JSON.stringify(hidden));
        } catch { /* ignore bad data */ }
      }
    }).catch(() => {});

    const onChange = (e) => setHiddenPages(e.detail);
    window.addEventListener('hidden-pages-changed', onChange);
    return () => window.removeEventListener('hidden-pages-changed', onChange);
  }, []);

  const show = (path) => !hiddenPages.includes(path);
  const impersonatingData = localStorage.getItem('impersonating')
    ? JSON.parse(localStorage.getItem('impersonating'))
    : null;

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('impersonateToken');
    localStorage.removeItem('impersonating');
    navigate('/login');
  };

  const stopImpersonating = () => {
    localStorage.removeItem('impersonateToken');
    localStorage.removeItem('impersonating');
    window.location.href = '/admin/users';
  };

  const closeMenu = () => setMenuOpen(false);

  const navLink = (to, label) => (
    <NavLink
      to={to}
      className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
      onClick={closeMenu}
    >
      {label}
    </NavLink>
  );

  return (
    <div className="app-layout">
      {impersonatingData && (
        <div className="impersonation-banner">
          Impersonating: <strong>{impersonatingData.name}</strong>
          <button className="btn btn-sm" onClick={stopImpersonating} style={{ marginLeft: 16 }}>
            Stop Impersonating
          </button>
        </div>
      )}
      <nav className="navbar">
        <div className="navbar-brand">
          <NavLink to="/dashboard" className="brand-name" style={{ textDecoration: 'none' }}>BudgetBuddy</NavLink>
        </div>

        {/* Desktop links */}
        <div className="navbar-links">
          {navLink('/dashboard', 'Dashboard')}
          {show('/bills') && navLink('/bills', 'Bills')}
          {show('/split-payments') && navLink('/split-payments', 'Split Payments')}
          {show('/loans') && navLink('/loans', 'Loans')}
          {show('/budgets') && navLink('/budgets', 'Budgets')}
          {show('/transactions') && navLink('/transactions', 'Transactions')}
          {show('/savings-goals') && navLink('/savings-goals', 'Savings')}
          {show('/subscriptions') && navLink('/subscriptions', 'Subscriptions')}
          {show('/reports') && navLink('/reports', 'Reports')}
          {navLink('/settings', 'Settings')}
          {isAdmin && navLink('/admin', 'Admin')}
        </div>

        <div className="navbar-actions">
          <button
            className="btn btn-icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ fontSize: 18 }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-ghost desktop-only" onClick={logout}>Logout</button>

          {/* Hamburger button — mobile only */}
          <button
            className="btn btn-icon hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="mobile-menu">
          {navLink('/dashboard', 'Dashboard')}
          {show('/bills') && navLink('/bills', 'Bills')}
          {show('/split-payments') && navLink('/split-payments', 'Split Payments')}
          {show('/loans') && navLink('/loans', 'Loans')}
          {show('/budgets') && navLink('/budgets', 'Budgets')}
          {show('/transactions') && navLink('/transactions', 'Transactions')}
          {show('/savings-goals') && navLink('/savings-goals', 'Savings')}
          {show('/subscriptions') && navLink('/subscriptions', 'Subscriptions')}
          {show('/reports') && navLink('/reports', 'Reports')}
          {navLink('/settings', 'Settings')}
          {isAdmin && navLink('/admin', 'Admin')}
          <button className="nav-link mobile-logout" onClick={() => { closeMenu(); logout(); }}>
            Logout
          </button>
        </div>
      )}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
