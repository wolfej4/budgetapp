import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <span className="admin-nav-title">Admin Panel</span>
        <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}>Users</NavLink>
        <NavLink to="/admin/stats" className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}>Stats</NavLink>
        <NavLink to="/admin/budgets" className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}>Budgets</NavLink>
        <NavLink to="/admin/settings" className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}>Settings</NavLink>
      </nav>
      <div style={{ padding: '24px' }}>
        <Outlet />
      </div>
    </div>
  );
}
