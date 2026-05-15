import React, { useEffect, useState } from 'react';
import { bailleurApi } from '@services/bailleurApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurStats, LandlordDashboard } from '@/types/bailleur';
import { StatsWidgetGrid } from '@components/bailleur/StatsWidget';
import { LandlordDashboardPanels } from '@components/bailleur/LandlordDashboardPanels';
import '@components/bailleur/bailleur.css';

/**
 * Tableau de bord bailleur — KPI, répartition IA, escalades (Sprint D).
 */
const LandlordDashboardPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<LandlordDashboard | null>(null);
  const [stats, setStats] = useState<BailleurStats | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setErr('');
        const d = await bailleurApi.getLandlordDashboard();
        setDashboard(d);
        setStats({
          housingCount: d.stats.housingCount,
          tenantCount: d.stats.tenantCount,
          openTickets: d.stats.openTickets,
          invoiceTotal: d.stats.invoices.total,
          invoicePaid: d.stats.invoices.paid,
          invoicePending: d.stats.invoices.pending,
        });
      } catch (e) {
        setErr(getErrorMessage(e, 'Chargement impossible'));
      }
    })();
  }, []);

  return (
    <div className="container">
      <h1>Tableau de bord</h1>
      {dashboard ? (
        <p style={{ color: '#64748b', maxWidth: 640 }}>
          Bonjour <strong>{dashboard.profile.name}</strong> — vue d&apos;ensemble
          de votre parc et du routage IA des réclamations.
        </p>
      ) : (
        <p style={{ color: '#64748b', maxWidth: 640 }}>
          Vue d&apos;ensemble de votre parc : logements, locataires, tickets et
          factures.
        </p>
      )}
      {err ? <div className="alert error">{err}</div> : null}

      {stats ? <StatsWidgetGrid stats={stats} /> : !err ? <p>Chargement…</p> : null}

      {dashboard ? <LandlordDashboardPanels dashboard={dashboard} /> : null}
    </div>
  );
};

export default LandlordDashboardPage;
