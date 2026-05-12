import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { locataireApi } from '@services/locataireApi';
import { getErrorMessage } from '@services/apiClient';
import type { TenantPaymentDetail } from '@/types/locataire';
import { PaymentStatusBadge } from '@components/locataire/PaymentStatusBadge';
import '@components/locataire/locataire.css';

const LocatairePaymentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<TenantPaymentDetail | null>(null);
  const [err, setErr] = useState('');

  const docId = id ? parseInt(id, 10) : NaN;

  useEffect(() => {
    if (!Number.isFinite(docId)) return;
    locataireApi
      .getPaymentDetails(docId)
      .then(setRow)
      .catch((e) => setErr(getErrorMessage(e, 'Introuvable')));
  }, [docId]);

  return (
    <div className="container">
      <button
        type="button"
        className="secondary"
        onClick={() => navigate('/locataire/paiements')}
      >
        ← Retour
      </button>
      <h1>Quittance #{id}</h1>
      {err ? <div className="alert error">{err}</div> : null}

      {row ? (
        <div className="card" style={{ maxWidth: 560 }}>
          <p>
            <PaymentStatusBadge status={row.status} />
          </p>
          <p>
            <strong>{row.label}</strong>
          </p>
          <p>Créée le : {new Date(row.createdAt).toLocaleString('fr-FR')}</p>
          {row.fileName ? (
            <p>
              Fichier associé : <code>{row.fileName}</code>
              <br />
              <small style={{ color: '#64748b' }}>
                Téléchargement direct : à brancher sur une route fichier
                sécurisée (CDN / API).
              </small>
            </p>
          ) : (
            <p style={{ color: '#64748b' }}>Document en cours de génération.</p>
          )}
        </div>
      ) : !err ? (
        <p>Chargement…</p>
      ) : null}
    </div>
  );
};

export default LocatairePaymentDetailPage;
