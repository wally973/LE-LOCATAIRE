import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import adminApi, {
  Landlord,
  PaginatedResponse,
  UserStatusFilter,
} from '../services/adminApi';
import { loadAdminPrefs } from '../hooks/adminPrefs';

/**
 * Liste des bailleurs avec recherche temps réel (debounce), filtres et pagination.
 */
const LandlordsPage: React.FC = () => {
  const [result, setResult] = useState<PaginatedResponse<Landlord> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatusFilter>('all');
  const [limit, setLimit] = useState(() => loadAdminPrefs().pageSize);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const fetchLandlords = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminApi.getLandlords({
        page,
        limit,
        search: search || undefined,
        status: status === 'all' ? undefined : status,
      });
      setResult(data);
    } catch {
      setError('Erreur lors du chargement des bailleurs');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status]);

  useEffect(() => {
    fetchLandlords();
  }, [fetchLandlords]);

  useEffect(() => {
    const onPrefs = () => setLimit(loadAdminPrefs().pageSize);
    window.addEventListener('admin-prefs-changed', onPrefs);
    return () => window.removeEventListener('admin-prefs-changed', onPrefs);
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Supprimer définitivement ce bailleur ?')) return;
    try {
      await adminApi.deleteLandlord(id);
      await fetchLandlords();
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const toggleAvailability = async (landlord: Landlord, next: boolean) => {
    const label = next ? 'réactiver' : 'désactiver';
    if (!window.confirm(`Voulez-vous ${label} ce compte ?`)) return;
    try {
      await adminApi.setUserAvailability(landlord.id, next);
      await fetchLandlords();
    } catch {
      setError(`Erreur lors de la tentative de ${label}`);
    }
  };

  if (loading && !result) return <div>Chargement...</div>;

  return (
    <div className="container">
      <h1>Gestion des Bailleurs</h1>

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
          <label htmlFor="landlord-search">
            Recherche (nom, email, téléphone)
          </label>
          <input
            id="landlord-search"
            type="search"
            placeholder="Tapez pour filtrer…"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="landlord-status">Statut</label>
          <select
            id="landlord-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as UserStatusFilter);
              setPage(1);
            }}
          >
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Désactivés</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="landlord-limit">Par page</label>
          <select
            id="landlord-limit"
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
            <th>Nom</th>
            <th>Email</th>
            <th>Téléphone</th>
            <th>Logements</th>
            <th>Statut</th>
            <th>Créé le</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(result?.data ?? []).map((landlord) => (
            <tr key={landlord.id}>
              <td>{landlord.id}</td>
              <td>{landlord.landlord?.name || 'N/A'}</td>
              <td>{landlord.email ?? '—'}</td>
              <td>{landlord.phone}</td>
              <td>{landlord.landlord?.housings?.length ?? 0}</td>
              <td>
                {landlord.isAvailable === false ? (
                  <span className="alert warning" style={{ padding: '4px 8px', margin: 0 }}>
                    Désactivé
                  </span>
                ) : (
                  <span style={{ color: '#155724' }}>Actif</span>
                )}
              </td>
              <td>{new Date(landlord.createdAt).toLocaleDateString('fr-FR')}</td>
              <td>
                <Link to={`/landlords/${landlord.id}`} className="nav-link">
                  <button
                    type="button"
                    className="primary"
                    style={{ padding: '5px 10px', fontSize: '12px' }}
                  >
                    Voir
                  </button>
                </Link>
                <button
                  type="button"
                  className="secondary"
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    marginLeft: 6,
                  }}
                  onClick={() =>
                    toggleAvailability(landlord, landlord.isAvailable === false)
                  }
                >
                  {landlord.isAvailable === false ? 'Activer' : 'Désactiver'}
                </button>
                <button
                  type="button"
                  className="danger"
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    marginLeft: 6,
                  }}
                  onClick={() => handleDelete(landlord.id)}
                >
                  Supprimer
                </button>
              </td>
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
            {result.meta.total} résultat(s) — page {result.meta.page} /{' '}
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

export default LandlordsPage;
