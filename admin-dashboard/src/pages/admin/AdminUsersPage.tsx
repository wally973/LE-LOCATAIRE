import React, { useEffect, useMemo, useState } from 'react';
import { usersApi, type ApiUser } from '@services/usersApi';
import { getErrorMessage } from '@services/apiClient';

const AdminUsersPage: React.FC = () => {
  const [rows, setRows] = useState<ApiUser[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [err, setErr] = useState('');

  useEffect(() => {
    usersApi
      .list()
      .then(setRows)
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')));
  }, []);

  const filtered = useMemo(() => {
    if (roleFilter === 'ALL') return rows;
    return rows.filter((u) => u.role === roleFilter);
  }, [rows, roleFilter]);

  return (
    <div className="container">
      <h1>Utilisateurs</h1>
      <p style={{ color: '#555' }}>
        Liste globale (API <code>/users</code>). Changement de rôle réservé aux
        super-admins côté métier.
      </p>
      {err ? <div className="alert error">{err}</div> : null}
      <div className="form-group" style={{ maxWidth: 200 }}>
        <label>Rôle</label>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="ALL">Tous</option>
          <option value="ADMIN">ADMIN</option>
          <option value="LANDLORD">LANDLORD</option>
          <option value="TENANT">TENANT</option>
          <option value="ARTISAN">ARTISAN</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Téléphone</th>
            <th>Rôle</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.email ?? '—'}</td>
              <td>{u.phone}</td>
              <td>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminUsersPage;
