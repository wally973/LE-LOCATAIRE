import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import authService from '@services/authService';
import { NotificationBell } from '@components/NotificationBell';
import '@layouts/landlord-layout.css';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `ld-link${isActive ? ' ld-link--active' : ''}`;

const AgentLayout: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  return (
    <div className="ld-layout">
      <header className="ld-nav">
        <div className="ld-brand">
          <button
            type="button"
            className="ld-toggle"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            ☰
          </button>
          <h1>Technicien secteur — Le Locataire</h1>
        </div>
        <div className="ld-actions">
          <NotificationBell />
          <button
            type="button"
            className="ld-logout"
            onClick={() => {
              authService.logout();
              navigate('/login');
            }}
          >
            Déconnexion
          </button>
        </div>
      </header>
      <div className="ld-body">
        <aside className={`ld-sidebar ${open ? 'open' : 'closed'}`}>
          <nav>
            <NavLink to="/agent/reclamations" className={navCls}>
              Mes alertes
            </NavLink>
          </nav>
        </aside>
        <main className="ld-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AgentLayout;
