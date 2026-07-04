import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { bailleurApi } from '@services/bailleurApi';
import { ticketsApi, type TicketStatusUi } from '@services/ticketsApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurTicket } from '@/types/bailleur';
import { TicketStatusBadge } from '@components/bailleur/TicketStatusBadge';
import { ResponsibilityBadge } from '@components/bailleur/ResponsibilityBadge';
import { ProBriefingPanel } from '@components/bailleur/ProBriefingPanel';
import { ExpertRectificationForm } from '@components/bailleur/ExpertRectificationForm';
import { MissionTimeline } from '@components/agent/MissionTimeline';
import { UrgencyBadge } from '@components/agent/UrgencyBadge';
import type { TicketMessageRow } from '@/types/agent';
import '@components/bailleur/bailleur.css';
import './agent-sector.css';

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

const AgentTicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<BailleurTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessageRow[]>([]);
  const [status, setStatus] = useState<TicketStatusUi>('OPEN');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [briefingKey, setBriefingKey] = useState(0);

  const reload = () => {
    if (!id) return;
    const ticketId = parseInt(id, 10);
    ticketsApi
      .getOne(ticketId)
      .then((t) => {
        setTicket(t as BailleurTicket);
        setStatus((t as BailleurTicket).status as TicketStatusUi);
      })
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')));
    ticketsApi
      .getMessages(ticketId)
      .then(setMessages)
      .catch(() => setMessages([]));
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

  const sendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !note.trim()) return;
    try {
      setBusy(true);
      setErr('');
      setMsg('');
      const stamp = new Date().toLocaleString('fr-FR');
      const block = `\n\n--- Note technicien secteur (${stamp}) ---\n${note.trim()}`;
      const desc = ticket?.description ?? '';
      await ticketsApi.update(parseInt(id, 10), {
        description: `${desc}${block}`,
      });
      setNote('');
      setMsg('Note terrain enregistrée.');
      reload();
    } catch (ex) {
      setErr(getErrorMessage(ex, 'Envoi impossible'));
    } finally {
      setBusy(false);
    }
  };

  if (!ticket && !err) return <p className="container">Chargement…</p>;

  const severity =
    (ticket as BailleurTicket & { aiSeverity?: string | null })?.aiSeverity ??
    null;

  return (
    <div className="container">
      <button
        type="button"
        className="secondary"
        onClick={() => navigate('/agent/reclamations')}
      >
        ← Mes alertes
      </button>

      <h1>Mission terrain</h1>

      {err ? <div className="alert error">{err}</div> : null}
      {msg ? <div className="alert success">{msg}</div> : null}

      <div className="agent-mission-banner">
        <p>
          <strong>Alerte transmise.</strong> Vous organisez la prise de contact
          avec le locataire et l’intervention — l’application ne planifie pas les
          prestataires ni les délais.
        </p>
      </div>

      {ticket ? (
        <>
          <div className="card">
            <div className="agent-mission-header">
              {ticket.caseNumber ? (
                <code>{ticket.caseNumber}</code>
              ) : (
                <code>#{ticket.id}</code>
              )}
              <TicketStatusBadge status={ticket.status} />
              <UrgencyBadge severity={severity} />
              {ticket.responsibility ? (
                <ResponsibilityBadge responsibility={ticket.responsibility} />
              ) : null}
            </div>
            <p style={{ marginTop: 0 }}>
              <strong>{ticket.title}</strong>
            </p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Logement : {ticket.housing?.address ?? '—'}
              {ticket.tenant
                ? ` — ${ticket.tenant.firstName ?? ''} ${ticket.tenant.lastName ?? ''}`
                : ''}
            </p>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <h2 style={{ marginTop: 0 }}>Fil qualifié</h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Constats locataire, échanges Lia et événements dossier.
            </p>
            <MissionTimeline
              messages={messages}
              infoEvents={ticket.landlordInfoEvents}
            />
          </div>

          {id ? (
            <>
              <ProBriefingPanel
                key={briefingKey}
                ticketId={parseInt(id, 10)}
              />
              <ExpertRectificationForm
                ticketId={parseInt(id, 10)}
                currentResponsibility={ticket.responsibility}
                onRectified={() => {
                  setBriefingKey((k) => k + 1);
                  reload();
                }}
              />
            </>
          ) : null}

          <div className="card" style={{ marginTop: 20 }}>
            <h2 style={{ marginTop: 0 }}>Suivi mission</h2>
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

          <form className="card" style={{ marginTop: 20 }} onSubmit={sendNote}>
            <h2 style={{ marginTop: 0 }}>Note terrain</h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Compte-rendu interne ou consigne pour le dossier (historique ticket).
            </p>
            <div className="form-group">
              <label htmlFor="note">Note</label>
              <textarea
                id="note"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Constat sur place, pièces à prévoir…"
              />
            </div>
            <button type="submit" className="primary" disabled={busy}>
              Enregistrer la note
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
};

export default AgentTicketDetailPage;
