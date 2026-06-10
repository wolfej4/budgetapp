import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useTheme from '../hooks/useTheme.js';

export default function Navbar() {
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';
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
          <span className="brand-name">BudgetBuddy</span>
        </div>

        {/* Desktop links */}
        <div className="navbar-links">
          {navLink('/dashboard', 'Dashboard')}
          {navLink('/bills', 'Bills')}
          {navLink('/split-payments', 'Split Payments')}
          {navLink('/loans', 'Loans')}
          {navLink('/budgets', 'Budgets')}
          {navLink('/transactions', 'Transactions')}
          {navLink('/savings-goals', 'Savings')}
          {navLink('/subscriptions', 'Subscriptions')}
          {navLink('/reports', 'Reports')}
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
          {navLink('/bills', 'Bills')}
          {navLink('/split-payments', 'Split Payments')}
          {navLink('/loans', 'Loans')}
          {navLink('/budgets', 'Budgets')}
          {navLink('/transactions', 'Transactions')}
          {navLink('/savings-goals', 'Savings')}
          {navLink('/subscriptions', 'Subscriptions')}
          {navLink('/reports', 'Reports')}
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
