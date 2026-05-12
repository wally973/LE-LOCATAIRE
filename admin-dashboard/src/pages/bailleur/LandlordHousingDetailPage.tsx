import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bailleurApi } from '@services/bailleurApi';
import { housingApi } from '@services/landlordApi';
import { getErrorMessage } from '@services/apiClient';
import type { BailleurHousing, BailleurTicket } from '@/types/bailleur';
import { TicketList } from '@components/bailleur/TicketList';
import '@components/bailleur/bailleur.css';

const CITIES = [
  'Cayenne',
  'Matoury',
  'Kourou',
  'Saint-Laurent-du-Maroni',
  'Autre (Guyane)',
];

const LandlordHousingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [housing, setHousing] = useState<BailleurHousing | null>(null);
  const [addr, setAddr] = useState('');
  const [city, setCity] = useState('');
  const [cp, setCp] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const hid = id ? parseInt(id, 10) : NaN;

  const [housingTickets, setHousingTickets] = useState<BailleurTicket[]>([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(hid)) return;
    try {
      setErr('');
      const list = await bailleurApi.getMyHousings();
      const h = list.find((x) => x.id === hid);
      if (!h) {
        setHousing(null);
        setErr('Logement introuvable ou hors de votre parc.');
        return;
      }
      setHousing(h);
      setAddr(h.address);
      setCity(h.city);
      setCp(h.postalCode);
    } catch (e) {
      setErr(getErrorMessage(e, 'Erreur de chargement'));
    }
  }, [hid]);

  useEffect(() => {
    if (!housing) {
      setHousingTickets([]);
      return;
    }
    bailleurApi
      .getMyTickets()
      .then((list) =>
        setHousingTickets(list.filter((t) => t.housing?.id === housing.id)),
      )
      .catch(() => setHousingTickets([]));
  }, [housing]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(hid)) return;
    try {
      setErr('');
      setMsg('');
      await housingApi.update(hid, {
        address: addr,
        city,
        postalCode: cp,
      });
      setMsg('Modifications enregistrées.');
      await load();
    } catch (ex) {
      setErr(getErrorMessage(ex, 'Enregistrement impossible'));
    }
  };

  return (
    <div className="container">
      <button
        type="button"
        className="secondary"
        onClick={() => navigate('/bailleur/logements')}
        style={{ marginBottom: 16 }}
      >
        ← Mes logements
      </button>

      <h1>Détail logement</h1>
      {err ? <div className="alert error">{err}</div> : null}
      {msg ? <div className="alert success">{msg}</div> : null}

      {housing ? (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Informations</h2>
            <form onSubmit={save} className="grid">
              <div className="form-group">
                <label>Adresse</label>
                <input
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Ville</label>
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  {CITIES.includes(city) ? null : (
                    <option value={city}>{city}</option>
                  )}
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
                  Enregistrer
                </button>
              </div>
            </form>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Locataire actuel</h2>
            {housing.currentTenant ? (
              <p>
                <strong>
                  {housing.currentTenant.firstName} {housing.currentTenant.lastName}
                </strong>
                {housing.currentTenant.user?.email
                  ? ` — ${housing.currentTenant.user.email}`
                  : ''}
                <br />
                <Link
                  to={`/bailleur/locataires/${housing.currentTenant.id}`}
                  className="bailleur-card__link"
                  style={{ display: 'inline-block', marginTop: 8 }}
                >
                  Voir la fiche →
                </Link>
              </p>
            ) : (
              <p style={{ color: '#64748b' }}>Aucun locataire assigné.</p>
            )}
          </div>

          <section className="bailleur-dash-section">
            <h2>Tickets sur ce logement</h2>
            <TicketList
              tickets={housingTickets}
              emptyLabel="Aucun ticket pour ce logement."
            />
          </section>
        </>
      ) : !err ? (
        <p>Chargement…</p>
      ) : null}
    </div>
  );
};

export default LandlordHousingDetailPage;
