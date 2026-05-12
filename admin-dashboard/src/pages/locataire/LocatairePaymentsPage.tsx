import React, { useEffect, useState } from 'react';
import { locataireApi } from '@services/locataireApi';
import { getErrorMessage } from '@services/apiClient';
import type { TenantPaymentRow } from '@/types/locataire';
import { PaymentHistoryTable } from '@components/locataire/PaymentHistoryTable';
import '@components/locataire/locataire.css';

const LocatairePaymentsPage: React.FC = () => {
  const [rows, setRows] = useState<TenantPaymentRow[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    locataireApi
      .getMyPayments()
      .then(setRows)
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')));
  }, []);

  return (
    <div className="container">
      <h1>Mes paiements & quittances</h1>
      <p style={{ color: '#64748b', maxWidth: 640 }}>
        Quittances de loyer enregistrées pour votre compte. Le paiement en ligne
        (Stripe) viendra compléter cet écran.
      </p>
      {err ? <div className="alert error">{err}</div> : null}
      <PaymentHistoryTable rows={rows} />
    </div>
  );
};

export default LocatairePaymentsPage;
