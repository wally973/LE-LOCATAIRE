import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bailleurApi } from '@services/bailleurApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurTicket, TicketResponsibilityUi } from '@/types/bailleur';
import { TicketList } from '@components/bailleur/TicketList';
import { ResponsibilityBadge } from '@components/bailleur/ResponsibilityBadge';
import '@components/bailleur/bailleur.css';

const FILTERS: { value: '' | TicketResponsibilityUi; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'ESCALADE_BAILLEUR', label: 'Escalades' },
  { value: 'PENDING', label: 'IA en attente' },
  { value: 'BAILLEUR', label: 'Bailleur' },
  { value: 'LOCATAIRE', label: 'Locataire' },
  { value: 'SOCIAL', label: 'Social' },
  { value: 'NON_RECEVABLE', label: 'Non recevable' },
];

const LandlordTicketsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get('responsibility') ?? '') as
    | ''
    | TicketResponsibilityUi;
  const [rows, setRows] = useState<BailleurTicket[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    bailleurApi
      .getMyTickets(filter || undefined)
      .then(setRows)
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="container">
      <h1>Tickets</h1>
      <p style={{ color: '#64748b', maxWidth: 640 }}>
        Tickets sur vos logements. Filtrez par décision de routage IA.
      </p>

      <div className="bailleur-filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            className={
              filter === f.value
                ? 'bailleur-filter-btn bailleur-filter-btn--active'
                : 'bailleur-filter-btn'
            }
            onClick={() => {
              if (f.value) {
                setSearchParams({ responsibility: f.value });
              } else {
                setSearchParams({});
              }
            }}
          >
            {f.value ? <ResponsibilityBadge responsibility={f.value} /> : f.label}
          </button>
        ))}
      </div>

      {err ? <div className="alert error">{err}</div> : null}
      {loading ? (
        <p>Chargement…</p>
      ) : (
        <TicketList tickets={rows} />
      )}
      <p style={{ marginTop: 24 }}>
        <Link to="/bailleur/dashboard" className="bailleur-card__link">
          ← Tableau de bord
        </Link>
      </p>
    </div>
  );
};

export default LandlordTicketsPage;
