import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useTheme from '../hooks/useTheme.js';

export default function Navbar() {
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
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
        <div className="navbar-links">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink>
          <NavLink to="/bills" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Bills</NavLink>
          <NavLink to="/split-payments" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Split Payments</NavLink>
          <NavLink to="/loans" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Loans</NavLink>
          <NavLink to="/budgets" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Budgets</NavLink>
          <NavLink to="/income" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Income</NavLink>
          <NavLink to="/savings-goals" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Savings</NavLink>
          <NavLink to="/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Reports</NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Settings</NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Admin</NavLink>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ fontSize: 18 }}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button className="btn btn-ghost" onClick={logout}>Logout</button>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
