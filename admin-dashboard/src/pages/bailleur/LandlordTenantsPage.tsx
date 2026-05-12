import React, { useEffect, useState } from 'react';
import { bailleurApi } from '@services/bailleurApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurTenantWithHousing } from '@/types/bailleur';
import { TenantCard } from '@components/bailleur/TenantCard';
import '@components/bailleur/bailleur.css';

const LandlordTenantsPage: React.FC = () => {
  const [rows, setRows] = useState<BailleurTenantWithHousing[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await bailleurApi.getMyTenants();
        setRows(list);
      } catch (e) {
        setErr(getErrorMessage(e, 'Erreur'));
      }
    })();
  }, []);

  return (
    <div className="container">
      <h1>Mes locataires</h1>
      <p style={{ color: '#64748b', maxWidth: 640 }}>
        Locataires actuellement rattachés à l’un de vos logements.
      </p>
      {err ? <div className="alert error">{err}</div> : null}

      <div className="bailleur-card-grid">
        {rows.map((r) => (
          <TenantCard key={`${r.tenant.id}-${r.housing.id}`} row={r} />
        ))}
      </div>
      {rows.length === 0 && !err ? (
        <p style={{ color: '#64748b' }}>Aucun locataire assigné pour le moment.</p>
      ) : null}
    </div>
  );
};

export default LandlordTenantsPage;
