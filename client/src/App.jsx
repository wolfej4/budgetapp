import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import BillsCalendar from './pages/BillsCalendar.jsx';
import SplitPayments from './pages/SplitPayments.jsx';
import Loans from './pages/Loans.jsx';
import Budgets from './pages/Budgets.jsx';
import Transactions from './pages/Transactions.jsx';
import SavingsGoals from './pages/SavingsGoals.jsx';
import Subscriptions from './pages/Subscriptions.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminStats from './pages/admin/AdminStats.jsx';
import AdminBudgets from './pages/admin/AdminBudgets.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute><Navbar /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="bills" element={<BillsCalendar />} />
          <Route path="split-payments" element={<SplitPayments />} />
          <Route path="loans" element={<Loans />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="income" element={<Navigate to="/transactions" replace />} />
          <Route path="savings-goals" element={<SavingsGoals />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/users" replace />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="stats" element={<AdminStats />} />
            <Route path="budgets" element={<AdminBudgets />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
