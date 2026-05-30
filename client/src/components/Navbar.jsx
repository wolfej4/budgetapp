import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();

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
        </div>
        <button className="btn btn-ghost" onClick={logout}>Logout</button>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
