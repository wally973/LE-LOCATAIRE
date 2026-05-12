import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { bailleurApi } from '@services/bailleurApi';
import { ticketsApi, type TicketStatusUi } from '@services/ticketsApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurTicket } from '@/types/bailleur';
import { TicketStatusBadge } from '@components/bailleur/TicketStatusBadge';
import '@components/bailleur/bailleur.css';

const STATUS_LABEL: Record<TicketStatusUi, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
  CANCELLED: 'Clos',
};

const STATUSES: TicketStatusUi[] = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELLED',
];

const LandlordTicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<BailleurTicket | null>(null);
  const [status, setStatus] = useState<TicketStatusUi>('OPEN');
  const [reply, setReply] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => {
    if (!id) return;
    ticketsApi
      .getOne(parseInt(id, 10))
      .then((t) => {
        setTicket(t as BailleurTicket);
        setStatus((t as BailleurTicket).status as TicketStatusUi);
      })
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')));
  };

  useEffect(() => {
    reload();
  }, [id]);

  const saveStatus = async () => {
    if (!id) return;
    try {
      setBusy(true);
      setErr('');
      setMsg('');
      await bailleurApi.updateTicketStatus(parseInt(id, 10), status);
      setMsg('Statut enregistré.');
      reload();
    } catch (e) {
      setErr(getErrorMessage(e, 'Mise à jour impossible'));
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !reply.trim()) return;
    try {
      setBusy(true);
      setErr('');
      setMsg('');
      await bailleurApi.replyToTicket(parseInt(id, 10), reply);
      setReply('');
      setMsg('Réponse ajoutée au fil du ticket.');
      reload();
    } catch (ex) {
      setErr(getErrorMessage(ex, 'Envoi impossible'));
    } finally {
      setBusy(false);
    }
  };

  if (!ticket && !err) return <p className="container">Chargement…</p>;

  return (
    <div className="container">
      <button
        type="button"
        className="secondary"
        onClick={() => navigate('/bailleur/tickets')}
      >
        ← Liste des tickets
      </button>
      <h1>Ticket #{id}</h1>
      {err ? <div className="alert error">{err}</div> : null}
      {msg ? <div className="alert success">{msg}</div> : null}

      {ticket ? (
        <>
          <div className="card">
            <p style={{ marginTop: 0 }}>
              <TicketStatusBadge status={ticket.status} />
            </p>
            <p>
              <strong>{ticket.title}</strong>
            </p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Logement : {ticket.housing?.address ?? '—'}
              {ticket.tenant
                ? ` — Locataire : ${ticket.tenant.firstName ?? ''} ${ticket.tenant.lastName ?? ''}`
                : ''}
            </p>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <h2 style={{ marginTop: 0 }}>Changer le statut</h2>
            <div className="form-group">
              <label htmlFor="st">Statut</label>
              <select
                id="st"
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatusUi)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="primary"
              onClick={() => void saveStatus()}
              disabled={busy}
            >
              Enregistrer le statut
            </button>
          </div>

          <form className="card" style={{ marginTop: 20 }} onSubmit={sendReply}>
            <h2 style={{ marginTop: 0 }}>Répondre au locataire</h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Votre message est ajouté à la description du ticket (historique
              interne jusqu’à route commentaires dédiée).
            </p>
            <div className="form-group">
              <label htmlFor="rep">Message</label>
              <textarea
                id="rep"
                rows={4}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Votre réponse…"
              />
            </div>
            <button type="submit" className="primary" disabled={busy}>
              Envoyer la réponse
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
};

export default LandlordTicketDetailPage;
