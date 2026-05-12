import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { locataireApi } from '@services/locataireApi';
import { getErrorMessage } from '@services/apiClient';
import type { TenantDashboardResponse } from '@/types/locataire';
import type { TenantTicketRow } from '@/types/locataire';
import { DashboardCard } from '@components/locataire/DashboardCard';
import { TicketList } from '@components/locataire/TicketList';
import '@components/locataire/locataire.css';

const LocataireDashboardPage: React.FC = () => {
  const [dash, setDash] = useState<TenantDashboardResponse | null>(null);
  const [recent, setRecent] = useState<TenantTicketRow[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setErr('');
        const [d, tickets] = await Promise.all([
          locataireApi.getTenantDashboard(),
          locataireApi.getMyTickets(),
        ]);
        setDash(d);
        const arr = Array.isArray(tickets) ? tickets : [];
        setRecent(
          arr
            .slice(0, 5)
            .map((t: Record<string, unknown>) => ({
              id: t.id as number,
              title: String(t.title ?? ''),
              description: String(t.description ?? ''),
              status: String(t.status ?? ''),
              createdAt: String(t.createdAt ?? ''),
              housing: t.housing as TenantTicketRow['housing'],
            })),
        );
      } catch (e) {
        setErr(getErrorMessage(e, 'Chargement impossible'));
      }
    })();
  }, []);

  return (
    <div className="container">
      <h1>Tableau de bord</h1>
      {err ? <div className="alert error">{err}</div> : null}

      {dash ? (
        <>
          <p style={{ color: '#64748b' }}>
            Bonjour{' '}
            <strong>
              {dash.profile.firstName} {dash.profile.lastName}
            </strong>
            {dash.housing ? (
              <>
                {' '}
                — logement : {dash.housing.address}, {dash.housing.city}
              </>
            ) : (
              ' — aucun logement attribué pour le moment.'
            )}
          </p>

          <div className="loca-grid" style={{ marginTop: 20 }}>
            <DashboardCard
              title="Tickets ouverts / en cours"
              value={dash.stats.openTickets}
            />
            <DashboardCard title="Total tickets" value={dash.stats.totalTickets} />
            <DashboardCard
              title="Quittances enregistrées"
              value={dash.stats.quittanceCount}
            />
          </div>

          <p style={{ marginTop: 16 }}>
            <Link to="/locataire/paiements">Voir mes paiements et quittances</Link>
            {' · '}
            <Link to="/locataire/tickets">Mes tickets</Link>
          </p>
        </>
      ) : !err ? (
        <p>Chargement…</p>
      ) : null}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18 }}>Derniers tickets</h2>
        <TicketList tickets={recent} emptyLabel="Aucun ticket récent." />
      </section>
    </div>
  );
};

export default LocataireDashboardPage;
