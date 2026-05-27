import React, { useEffect, useReducer, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import authService from '@services/authService';
import { NotificationBell } from '@components/NotificationBell';
import { canAccessAudit, canManageUsers } from '@auth/roles';
import './AdminLayout.css';

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const onRole = () => bump();
    window.addEventListener('admin-ui-role-changed', onRole);
    return () => window.removeEventListener('admin-ui-role-changed', onRole);
  }, []);

  const showAdmins = canManageUsers();
  const showAudit = canAccessAudit();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="admin-layout">
      <header className="navbar">
        <div className="navbar-brand">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            ☰
          </button>
          <h1>Le Locataire — Admin</h1>
        </div>
        <div className="navbar-actions">
          <NotificationBell />
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </header>

      <div className="layout-body">
        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <nav>
            <Link to="/admin/dashboard" className="nav-link">
              Dashboard
            </Link>
            {showAdmins ? (
              <Link to="/admin/admins" className="nav-link">
                Admins
              </Link>
            ) : null}
            <Link to="/admin/users" className="nav-link">
              Utilisateurs
            </Link>
            <Link to="/admin/tenants" className="nav-link">
              Locataires
            </Link>
            <Link to="/admin/landlords" className="nav-link">
              Bailleurs
            </Link>
            <Link to="/admin/housings" className="nav-link">
              Logements
            </Link>
            <Link to="/admin/tickets" className="nav-link">
              Tickets
            </Link>
            <Link to="/admin/payments" className="nav-link">
              Paiements
            </Link>
            <Link to="/admin/stats" className="nav-link">
              Statistiques
            </Link>
            {showAudit ? (
              <Link to="/admin/audit" className="nav-link">
                Audit
              </Link>
            ) : null}
            <Link to="/admin/settings" className="nav-link">
              Paramètres
            </Link>
            <Link to="/admin/avatars" className="nav-link">
              Avatars app
            </Link>
            <Link to="/admin/ia-stats" className="nav-link">
              Statistiques IA
            </Link>
            <Link to="/admin/lia-lab" className="nav-link">
              Lia-Lab (Jarvis)
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
