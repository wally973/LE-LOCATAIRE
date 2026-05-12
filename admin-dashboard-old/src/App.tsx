import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminsPage from './pages/AdminsPage';
import LandlordsPage from './pages/LandlordsPage';
import LandlordDetailsPage from './pages/LandlordDetailsPage';
import StatsPage from './pages/StatsPage';
import AuditLogPage from './pages/AuditLogPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import HousingsPage from './pages/HousingsPage';
import PrivateRoute from './components/PrivateRoute';
import { loadAdminPrefs } from './hooks/adminPrefs';
import './App.css';

function App() {
  useEffect(() => {
    const p = loadAdminPrefs();
    document.body.classList.toggle('theme-dark', p.theme === 'dark');
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/admins" element={<AdminsPage />} />
            <Route path="/landlords" element={<LandlordsPage />} />
            <Route path="/landlords/:id" element={<LandlordDetailsPage />} />
            <Route path="/housings" element={<HousingsPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/audit" element={<AuditLogPage />} />
            <Route path="/settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
