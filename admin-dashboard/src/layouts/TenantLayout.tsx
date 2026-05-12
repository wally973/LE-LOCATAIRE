import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import authService from '@services/authService';
import { NotificationBell } from '@components/NotificationBell';
import { AvatarCoachProvider } from '@/context/AvatarCoachContext';
import { MobileAvatarOverlay } from '@components/avatar/MobileAvatarOverlay';
import '@layouts/tenant-layout.css';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `tn-link${isActive ? ' tn-link--active' : ''}`;

const TenantLayout: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  return (
    <AvatarCoachProvider>
      <div className="tn-layout">
        <header className="tn-nav">
          <div className="tn-brand">
            <button
              type="button"
              className="tn-toggle"
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              ☰
            </button>
            <h1>Locataire — Le Locataire</h1>
          </div>
          <div className="tn-actions">
            <NotificationBell />
            <button
              type="button"
              className="tn-logout"
              onClick={() => {
                authService.logout();
                navigate('/login');
              }}
            >
              Déconnexion
            </button>
          </div>
        </header>
        <div className="tn-body">
          <aside className={`tn-sidebar ${open ? 'open' : 'closed'}`}>
            <nav>
              <NavLink to="/locataire/dashboard" className={linkClass}>
                Tableau de bord
              </NavLink>
              <NavLink to="/locataire/paiements" className={linkClass}>
                Paiements & quittances
              </NavLink>
              <NavLink to="/locataire/tickets" className={linkClass}>
                Mes tickets
              </NavLink>
              <NavLink to="/locataire/profil" className={linkClass}>
                Mon profil
              </NavLink>
              <NavLink to="/locataire/parametres" className={linkClass}>
                Paramètres
              </NavLink>
            </nav>
          </aside>
          <main className="tn-main">
            <Outlet />
          </main>
        </div>
        <MobileAvatarOverlay />
      </div>
    </AvatarCoachProvider>
  );
};

export default TenantLayout;
