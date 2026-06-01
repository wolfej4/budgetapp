import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const closeMenu = () => setMenuOpen(false);

  const adminLink = (to, label) => (
    <NavLink
      to={to}
      className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}
      onClick={closeMenu}
    >
      {label}
    </NavLink>
  );

  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <span className="admin-nav-title">Admin Panel</span>

        {/* Desktop links */}
        <div className="admin-nav-links">
          {adminLink('/admin/users', 'Users')}
          {adminLink('/admin/stats', 'Stats')}
          {adminLink('/admin/budgets', 'Budgets')}
          {adminLink('/admin/settings', 'Settings')}
        </div>

        {/* Hamburger — mobile only */}
        <button
          className="btn btn-icon admin-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle admin menu"
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
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="admin-mobile-menu">
          {adminLink('/admin/users', 'Users')}
          {adminLink('/admin/stats', 'Stats')}
          {adminLink('/admin/budgets', 'Budgets')}
          {adminLink('/admin/settings', 'Settings')}
        </div>
      )}

      <div style={{ padding: '24px' }}>
        <Outlet />
      </div>
    </div>
  );
}
