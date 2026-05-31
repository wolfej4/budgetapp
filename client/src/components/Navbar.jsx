import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useTheme from '../hooks/useTheme.js';

export default function Navbar() {
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="brand-icon">💰</span>
          <span className="brand-name">BudgetApp</span>
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ fontSize: 18 }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
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
