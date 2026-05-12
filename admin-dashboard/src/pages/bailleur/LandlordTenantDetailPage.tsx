import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bailleurApi } from '@services/bailleurApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurTenantWithHousing } from '@/types/bailleur';
import '@components/bailleur/bailleur.css';

const LandlordTenantDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<BailleurTenantWithHousing | null>(null);
  const [err, setErr] = useState('');

  const tid = id ? parseInt(id, 10) : NaN;

  useEffect(() => {
    if (!Number.isFinite(tid)) return;
    (async () => {
      try {
        setErr('');
        const list = await bailleurApi.getMyTenants();
        const found = list.find((r) => r.tenant.id === tid);
        setRow(found ?? null);
        if (!found) setErr('Locataire introuvable ou non lié à votre parc.');
      } catch (e) {
        setErr(getErrorMessage(e, 'Erreur de chargement'));
      }
    })();
  }, [tid]);

  return (
    <div className="container">
      <button
        type="button"
        className="secondary"
        onClick={() => navigate('/bailleur/locataires')}
        style={{ marginBottom: 16 }}
      >
        ← Mes locataires
      </button>

      <h1>Fiche locataire</h1>
      {err ? <div className="alert error">{err}</div> : null}

      {row ? (
        <div className="card" style={{ maxWidth: 560 }}>
          <h2 style={{ marginTop: 0 }}>
            {row.tenant.firstName} {row.tenant.lastName}
          </h2>
          <p>
            <strong>Email :</strong>{' '}
            {row.tenant.user?.email ?? '—'}
          </p>
          <p>
            <strong>Téléphone :</strong>{' '}
            {row.tenant.user?.phone ?? '—'}
          </p>
          <p>
            <strong>Logement :</strong> {row.housing.address},{' '}
            {row.housing.postalCode} {row.housing.city}
          </p>
          <p style={{ marginTop: 20 }}>
            <Link to={`/bailleur/logements/${row.housing.id}`} className="bailleur-card__link">
              Voir le logement →
            </Link>
          </p>
        </div>
      ) : !err ? (
        <p>Chargement…</p>
      ) : null}
    </div>
  );
};

export default LandlordTenantDetailPage;
