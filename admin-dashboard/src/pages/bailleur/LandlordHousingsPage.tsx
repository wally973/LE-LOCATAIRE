import React, { useEffect, useState } from 'react';
import { bailleurApi } from '@services/bailleurApi';
import { housingApi, landlordApi } from '@services/landlordApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurHousing } from '@/types/bailleur';
import { HousingCard } from '@components/bailleur/HousingCard';
import '@components/bailleur/bailleur.css';

const CITIES = [
  'Cayenne',
  'Matoury',
  'Kourou',
  'Saint-Laurent-du-Maroni',
  'Autre (Guyane)',
];

const LandlordHousingsPage: React.FC = () => {
  const [landlordProfileId, setLandlordProfileId] = useState<number | null>(
    null,
  );
  const [list, setList] = useState<BailleurHousing[]>([]);
  const [err, setErr] = useState('');
  const [addr, setAddr] = useState('');
  const [city, setCity] = useState('Cayenne');
  const [cp, setCp] = useState('97300');

  const load = async () => {
    try {
      setErr('');
      const me = await landlordApi.getProfile();
      setLandlordProfileId(me.landlord?.id ?? null);
      const h = await bailleurApi.getMyHousings();
      setList(h);
    } catch (e) {
      setErr(getErrorMessage(e, 'Erreur'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!landlordProfileId) return;
    try {
      await housingApi.create({
        address: addr,
        city,
        postalCode: cp,
        landlordId: landlordProfileId,
      });
      setAddr('');
      await load();
    } catch (ex) {
      setErr(getErrorMessage(ex, 'Création impossible'));
    }
  };

  return (
    <div className="container">
      <h1>Mes logements</h1>
      {err ? <div className="alert error">{err}</div> : null}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Nouveau logement</h2>
        <form onSubmit={submit} className="grid">
          <div className="form-group">
            <label>Adresse</label>
            <input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Ville (Guyane)</label>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Code postal</label>
            <input value={cp} onChange={(e) => setCp(e.target.value)} required />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button type="submit" className="primary">
              Créer
            </button>
          </div>
        </form>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Parc</h2>
      <div className="bailleur-card-grid">
        {list.map((h) => (
          <HousingCard key={h.id} housing={h} />
        ))}
      </div>
      {list.length === 0 && !err ? (
        <p style={{ color: '#64748b' }}>Aucun logement pour le moment.</p>
      ) : null}
    </div>
  );
};

export default LandlordHousingsPage;
