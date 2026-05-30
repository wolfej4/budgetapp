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
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
