import React, { useEffect, useState } from 'react';
import {
  AdminPrefs,
  loadAdminPrefs,
  saveAdminPrefs,
} from '@hooks/adminPrefs';
import {
  type AdminUiRole,
  getAdminUiRole,
  setAdminUiRole,
} from '@auth/roles';
import { NotificationSettingsCard } from '@components/NotificationSettingsCard';

/**
 * Paramètres locaux du dashboard (taille de page par défaut, thème).
 */
const AdminSettingsPage: React.FC = () => {
  const [prefs, setPrefs] = useState<AdminPrefs>(() => loadAdminPrefs());
  const [saved, setSaved] = useState(false);
  const [adminUiRole, setAdminUiRoleState] = useState<AdminUiRole>(() =>
    getAdminUiRole(),
  );

  useEffect(() => {
    document.body.classList.toggle('theme-dark', prefs.theme === 'dark');
  }, [prefs.theme]);

  const persist = (next: AdminPrefs) => {
    setPrefs(next);
    saveAdminPrefs(next);
    window.dispatchEvent(new Event('admin-prefs-changed'));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const persistAdminRole = (role: AdminUiRole) => {
    setAdminUiRole(role);
    setAdminUiRoleState(role);
    window.dispatchEvent(new Event('admin-ui-role-changed'));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="container">
      <h1>Paramètres Admin</h1>
      <p style={{ color: '#555', maxWidth: 560 }}>
        Ces réglages sont stockés dans votre navigateur uniquement. Ils affectent
        la taille de page par défaut sur les listes et le thème visuel du tableau
        de bord. Le profil de permissions admin (SUPER_ADMIN / SUPPORT / standard)
        est une prévisualisation locale jusqu’à ce que le JWT expose ces claims.
      </p>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label htmlFor="pref-admin-role">Profil permissions (UI)</label>
          <select
            id="pref-admin-role"
            value={adminUiRole}
            onChange={(e) =>
              persistAdminRole(e.target.value as AdminUiRole)
            }
          >
            <option value="SUPER_ADMIN">Super administrateur</option>
            <option value="ADMIN_STANDARD">Administrateur standard</option>
            <option value="SUPPORT">Support</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pref-page">Taille de page par défaut (listes)</label>
          <select
            id="pref-page"
            value={prefs.pageSize}
            onChange={(e) =>
              persist({ ...prefs, pageSize: Number(e.target.value) })
            }
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n} lignes
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pref-theme">Thème</label>
          <select
            id="pref-theme"
            value={prefs.theme}
            onChange={(e) =>
              persist({
                ...prefs,
                theme: e.target.value === 'dark' ? 'dark' : 'light',
              })
            }
          >
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </div>

        {saved ? (
          <div className="alert success" style={{ marginTop: 12 }}>
            Enregistré.
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 24 }}>
        <NotificationSettingsCard />
      </div>
    </div>
  );
};

export default AdminSettingsPage;
