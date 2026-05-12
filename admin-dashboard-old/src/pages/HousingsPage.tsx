import React, { useCallback, useEffect, useState } from 'react';
import adminApi, {
  Housing,
  HousingOccupancyFilter,
  PaginatedResponse,
} from '../services/adminApi';
import { loadAdminPrefs } from '../hooks/adminPrefs';

/**
 * Liste globale des logements avec recherche et filtre occupation.
 */
const HousingsPage: React.FC = () => {
  const [result, setResult] = useState<PaginatedResponse<Housing> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [occupancy, setOccupancy] = useState<HousingOccupancyFilter>('all');
  const [limit, setLimit] = useState(() => loadAdminPrefs().pageSize);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const fetchHousings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminApi.getHousings({
        page,
        limit,
        search: search || undefined,
        occupancy: occupancy === 'all' ? undefined : occupancy,
      });
      setResult(data);
    } catch {
      setError('Erreur lors du chargement des logements');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, occupancy]);

  useEffect(() => {
    fetchHousings();
  }, [fetchHousings]);

  useEffect(() => {
    const onPrefs = () => setLimit(loadAdminPrefs().pageSize);
    window.addEventListener('admin-prefs-changed', onPrefs);
    return () => window.removeEventListener('admin-prefs-changed', onPrefs);
  }, []);

  if (loading && !result) return <div className="container">Chargement...</div>;

  return (
    <div className="container">
      <h1>Logements</h1>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div className="form-group" style={{ marginBottom: 0, minWidth: 240 }}>
          <label htmlFor="housing-search">Recherche (adresse, code postal)</label>
          <input
            id="housing-search"
            type="search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="housing-occ">Occupation</label>
          <select
            id="housing-occ"
            value={occupancy}
            onChange={(e) => {
              setOccupancy(e.target.value as HousingOccupancyFilter);
              setPage(1);
            }}
          >
            <option value="all">Tous</option>
            <option value="occupied">Occupés</option>
            <option value="vacant">Vacants</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="housing-limit">Par page</label>
          <select
            id="housing-limit"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="alert error">{error}</div> : null}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Adresse</th>
            <th>Ville</th>
            <th>Bailleur</th>
            <th>Occupation</th>
            <th>Validé</th>
          </tr>
        </thead>
        <tbody>
          {(result?.data ?? []).map((h) => (
            <tr key={h.id}>
              <td>{h.id}</td>
              <td>{h.address}</td>
              <td>{h.city}</td>
              <td>{h.landlord?.name ?? '—'}</td>
              <td>
                {h.currentTenant
                  ? `${h.currentTenant.firstName} ${h.currentTenant.lastName}`
                  : 'Vacant'}
              </td>
              <td>{h.isValidated ? 'Oui' : 'Non'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {result ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
          }}
        >
          <span style={{ fontSize: 14, color: '#555' }}>
            {result.meta.total} logement(s) — page {result.meta.page} /{' '}
            {Math.max(1, result.meta.totalPages)}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Précédent
            </button>
            <button
              type="button"
              className="secondary"
              disabled={
                loading ||
                page >= (result.meta.totalPages || 1) ||
                result.meta.totalPages === 0
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </button>
          </div>
        </div>
      ) : null}

      {loading ? <p style={{ marginTop: 8 }}>Mise à jour…</p> : null}
    </div>
  );
};

export default HousingsPage;
