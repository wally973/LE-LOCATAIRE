import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ticketsApi, type TicketStatusUi } from '@services/ticketsApi';
import { getErrorMessage } from '@services/apiClient';

const STATUSES: TicketStatusUi[] = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELLED',
];

const AdminTicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [status, setStatus] = useState<TicketStatusUi>('OPEN');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    ticketsApi
      .getOne(parseInt(id, 10))
      .then((t) => {
        setTicket(t);
        setStatus(t.status);
      })
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')));
  }, [id]);

  const save = async () => {
    if (!id) return;
    try {
      await ticketsApi.update(parseInt(id, 10), { status });
      navigate('/admin/tickets');
    } catch (e) {
      setErr(getErrorMessage(e, 'Erreur'));
    }
  };

  if (!ticket && !err) return <p>Chargement…</p>;

  return (
    <div className="container">
      <button type="button" className="secondary" onClick={() => navigate(-1)}>
        ← Retour
      </button>
      <h1>Ticket #{id}</h1>
      {err ? <div className="alert error">{err}</div> : null}
      {ticket ? (
        <>
          <div className="card">
            <p>{ticket.description}</p>
          </div>
          <div className="form-group">
            <label>Statut</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TicketStatusUi)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="primary" onClick={save}>
            Enregistrer
          </button>
        </>
      ) : null}
    </div>
  );
};

export default AdminTicketDetailPage;
