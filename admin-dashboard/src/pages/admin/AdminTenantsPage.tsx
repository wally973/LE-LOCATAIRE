import React, { useEffect, useState } from 'react';
import { usersApi, type ApiUser } from '@services/usersApi';
import { getErrorMessage } from '@services/apiClient';

const AdminTenantsPage: React.FC = () => {
  const [rows, setRows] = useState<ApiUser[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    usersApi
      .list()
      .then((all) => setRows(all.filter((u) => u.role === 'TENANT')))
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')));
  }, []);

  return (
    <div className="container">
      <h1>Locataires</h1>
      {err ? <div className="alert error">{err}</div> : null}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Téléphone</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.email ?? '—'}</td>
              <td>{u.phone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminTenantsPage;
