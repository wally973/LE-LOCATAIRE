import React, { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import './AdminLayout.css';

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="admin-layout">
      <header className="navbar">
        <div className="navbar-brand">
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            ☰
          </button>
          <h1>Le Locataire - Admin</h1>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <div className="layout-body">
        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <nav>
            <Link to="/" className="nav-link">
              Dashboard
            </Link>
            <Link to="/admins" className="nav-link">
              Admins
            </Link>
            <Link to="/landlords" className="nav-link">
              Bailleurs
            </Link>
            <Link to="/housings" className="nav-link">
              Logements
            </Link>
            <Link to="/stats" className="nav-link">
              Statistiques
            </Link>
            <Link to="/audit" className="nav-link">
              Audit
            </Link>
            <Link to="/settings" className="nav-link">
              Paramètres
            </Link>
          </nav>
        </aside>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
