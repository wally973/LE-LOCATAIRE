import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import authService from '@services/authService';
import { NotificationBell } from '@components/NotificationBell';
import '@layouts/landlord-layout.css';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `ld-link${isActive ? ' ld-link--active' : ''}`;

const LandlordLayout: React.FC = () => {
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
          <h1>Bailleur — Le Locataire</h1>
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
            <NavLink to="/bailleur/dashboard" className={navCls}>
              Tableau de bord
            </NavLink>
            <NavLink to="/bailleur/logements" className={navCls}>
              Mes logements
            </NavLink>
            <NavLink to="/bailleur/locataires" className={navCls}>
              Mes locataires
            </NavLink>
            <NavLink to="/bailleur/paiements" className={navCls}>
              Paiements
            </NavLink>
            <NavLink to="/bailleur/recherche" className={navCls}>
              Recherche dossier
            </NavLink>
            <NavLink to="/bailleur/tickets" className={navCls}>
              Tickets
            </NavLink>
            <NavLink to="/bailleur/profil" className={navCls}>
              Mon profil
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

export default LandlordLayout;
