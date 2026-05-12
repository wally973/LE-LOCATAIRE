import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bailleurApi } from '@services/bailleurApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurTicket } from '@/types/bailleur';
import { TicketList } from '@components/bailleur/TicketList';
import '@components/bailleur/bailleur.css';

const LandlordTicketsPage: React.FC = () => {
  const [rows, setRows] = useState<BailleurTicket[]>([]);
  const [err, setErr] = useState('');

  const load = () =>
    bailleurApi
      .getMyTickets()
      .then(setRows)
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')));

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container">
      <h1>Tickets</h1>
      <p style={{ color: '#64748b', maxWidth: 640 }}>
        Tickets ouverts sur vos logements. Cliquez pour répondre ou modifier le
        statut.
      </p>
      {err ? <div className="alert error">{err}</div> : null}
      <TicketList tickets={rows} />
      <p style={{ marginTop: 24 }}>
        <Link to="/bailleur/dashboard" className="bailleur-card__link">
          ← Tableau de bord
        </Link>
      </p>
    </div>
  );
};

export default LandlordTicketsPage;
