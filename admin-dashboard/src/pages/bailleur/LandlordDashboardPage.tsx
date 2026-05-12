import React, { useEffect, useState } from 'react';
import { bailleurApi } from '@services/bailleurApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurStats, BailleurTicket } from '@/types/bailleur';
import { StatsWidgetGrid } from '@components/bailleur/StatsWidget';
import { TicketList } from '@components/bailleur/TicketList';
import '@components/bailleur/bailleur.css';

/**
 * Tableau de bord bailleur — KPIs et derniers tickets.
 */
const LandlordDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<BailleurStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<BailleurTicket[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setErr('');
        const [s, tickets] = await Promise.all([
          bailleurApi.getBailleurStats(),
          bailleurApi.getMyTickets(),
        ]);
        setStats(s);
        setRecentTickets(tickets.slice(0, 5));
      } catch (e) {
        setErr(getErrorMessage(e, 'Chargement impossible'));
      }
    })();
  }, []);

  return (
    <div className="container">
      <h1>Tableau de bord</h1>
      <p style={{ color: '#64748b', maxWidth: 640 }}>
        Vue d&apos;ensemble de votre parc : logements, locataires, tickets et
        factures d&apos;intervention.
      </p>
      {err ? <div className="alert error">{err}</div> : null}

      {stats ? <StatsWidgetGrid stats={stats} /> : !err ? <p>Chargement…</p> : null}

      <section className="bailleur-dash-section">
        <h2>Derniers tickets</h2>
        <TicketList tickets={recentTickets} emptyLabel="Aucun ticket récent." />
      </section>
    </div>
  );
};

export default LandlordDashboardPage;
