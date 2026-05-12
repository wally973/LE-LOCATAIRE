import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketsApi } from '@services/ticketsApi';
import { getErrorMessage } from '@services/apiClient';

const AdminTicketsPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    ticketsApi
      .getMine()
      .then((list) => setRows(Array.isArray(list) ? list : []))
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')));
  }, []);

  return (
    <div className="container">
      <h1>Tickets (supervision)</h1>
      <p style={{ color: '#555' }}>
        Vue admin : tous les tickets. Les statuts sont ceux du backend (
        OPEN, IN_PROGRESS, RESOLVED, CANCELLED).
      </p>
      {err ? <div className="alert error">{err}</div> : null}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Titre</th>
            <th>Statut</th>
            <th>Créé</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.title}</td>
              <td>{t.status}</td>
              <td>{new Date(t.createdAt).toLocaleString('fr-FR')}</td>
              <td>
                <Link to={`/admin/tickets/${t.id}`}>Voir</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminTicketsPage;
