import React, { useEffect, useState } from 'react';
import { tenantApi } from '@services/tenantApi';
import { locataireApi } from '@services/locataireApi';
import { getErrorMessage } from '@services/apiClient';
import type { TenantTicketRow } from '@/types/locataire';
import { TicketList } from '@components/locataire/TicketList';
import { useDiagnosticAI } from '@hooks/ai/useDiagnosticAI';
import '@components/locataire/locataire.css';

const LocataireTicketsPage: React.FC = () => {
  const { suggest } = useDiagnosticAI();
  const [rows, setRows] = useState<TenantTicketRow[]>([]);
  const [housingId, setHousingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState('');
  const [hint, setHint] = useState('');

  const load = async () => {
    const list = await locataireApi.getMyTickets();
    const arr = Array.isArray(list) ? list : [];
    setRows(
      arr.map((t: Record<string, unknown>) => ({
        id: t.id as number,
        title: String(t.title ?? ''),
        description: String(t.description ?? ''),
        status: String(t.status ?? ''),
        createdAt: String(t.createdAt ?? ''),
        housing: t.housing as TenantTicketRow['housing'],
      })),
    );
  };

  useEffect(() => {
    tenantApi
      .getMe()
      .then((me: { tenant?: { housingId?: number | null } }) =>
        setHousingId(me.tenant?.housingId ?? null),
      )
      .catch(() => {});
    load().catch((e) => setErr(getErrorMessage(e, 'Erreur')));
  }, []);

  useEffect(() => {
    if (desc.trim().length > 12) {
      const h = suggest(desc);
      setHint(`${h.hint} (orientation diagnostic locale)`);
    } else setHint('');
  }, [desc, suggest]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!housingId) {
      setErr('Aucun logement associé : impossible de créer un ticket.');
      return;
    }
    try {
      setErr('');
      await locataireApi.createTicket({
        title,
        description: desc,
        housingId,
      });
      setTitle('');
      setDesc('');
      await load();
    } catch (ex) {
      setErr(getErrorMessage(ex, 'Création impossible'));
    }
  };

  return (
    <div className="container">
      <h1>Mes tickets</h1>
      {err ? <div className="alert error">{err}</div> : null}

      <div className="card" style={{ marginBottom: 24 }} data-coach="new-ticket">
        <h2>Nouveau ticket</h2>
        {!housingId ? (
          <p className="alert warning">
            Votre compte doit être rattaché à un logement pour créer un ticket.
          </p>
        ) : (
          <form onSubmit={create}>
            <div className="form-group">
              <label>Titre</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                rows={4}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                required
              />
            </div>
            {hint ? (
              <p style={{ fontSize: 14, color: '#475569' }}>{hint}</p>
            ) : null}
            <button type="submit" className="primary">
              Envoyer
            </button>
          </form>
        )}
      </div>

      <h2 style={{ fontSize: 18 }}>Historique</h2>
      <TicketList tickets={rows} />
    </div>
  );
};

export default LocataireTicketsPage;
