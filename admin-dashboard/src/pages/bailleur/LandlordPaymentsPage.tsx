import React, { useEffect, useState } from 'react';
import { bailleurApi } from '@services/bailleurApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurInvoice } from '@/types/bailleur';
import { PaymentTable } from '@components/bailleur/PaymentTable';
import { StatsWidgetGrid } from '@components/bailleur/StatsWidget';
import type { BailleurStats } from '@/types/bailleur';
import '@components/bailleur/bailleur.css';

const LandlordPaymentsPage: React.FC = () => {
  const [rows, setRows] = useState<BailleurInvoice[]>([]);
  const [stats, setStats] = useState<BailleurStats | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setErr('');
        const [payments, s] = await Promise.all([
          bailleurApi.getMyPayments(),
          bailleurApi.getBailleurStats(),
        ]);
        setRows(payments);
        setStats(s);
      } catch (e) {
        setErr(getErrorMessage(e, 'Erreur'));
      }
    })();
  }, []);

  return (
    <div className="container">
      <h1>Mes paiements</h1>
      <p style={{ color: '#64748b', maxWidth: 640 }}>
        Factures d&apos;intervention (artisans) liées à vos dossiers. Lecture
        seule — la validation et Stripe pourront être branchés sur ces entrées.
      </p>
      {err ? <div className="alert error">{err}</div> : null}

      {stats ? <StatsWidgetGrid stats={stats} /> : null}

      <h2 style={{ fontSize: 18, marginTop: 8, marginBottom: 12 }}>Historique</h2>
      <PaymentTable rows={rows} />
    </div>
  );
};

export default LandlordPaymentsPage;
