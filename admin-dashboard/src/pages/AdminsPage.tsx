import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import adminApi, { Admin, PaginatedResponse, UserStatusFilter } from '@services/adminApi';
import { loadAdminPrefs } from '@hooks/adminPrefs';
import { canManageUsers } from '@auth/roles';

/**
 * Liste des administrateurs avec recherche (debounce), filtre de statut et pagination.
 */
const AdminsPage: React.FC = () => {
  const [result, setResult] = useState<PaginatedResponse<Admin> | null>(null);
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

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminApi.getAdmins({
        page,
        limit,
        search: search || undefined,
        status: status === 'all' ? undefined : status,
      });
      setResult(data);
    } catch {
      setError('Erreur lors du chargement des admins');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  useEffect(() => {
    const onPrefs = () => setLimit(loadAdminPrefs().pageSize);
    window.addEventListener('admin-prefs-changed', onPrefs);
    return () => window.removeEventListener('admin-prefs-changed', onPrefs);
  }, []);

  if (!canManageUsers()) return <Navigate to="/admin/dashboard" replace />;

  const handleDelete = async (id: number) => {
    if (!window.confirm('Supprimer définitivement cet administrateur ?')) return;
    try {
      await adminApi.deleteAdmin(id);
      await fetchAdmins();
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const toggleAvailability = async (admin: Admin, next: boolean) => {
    const label = next ? 'réactiver' : 'désactiver';
    if (!window.confirm(`Voulez-vous ${label} ce compte ?`)) return;
    try {
      await adminApi.setUserAvailability(admin.id, next);
      await fetchAdmins();
    } catch {
      setError(`Erreur lors de la tentative de ${label}`);
    }
  };

  if (loading && !result) return <div>Chargement...</div>;

  return (
    <div className="container">
      <h1>Gestion des Admins</h1>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
          <label htmlFor="admin-search">Recherche (email, téléphone)</label>
          <input
            id="admin-search"
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
          <label htmlFor="admin-status">Statut</label>
          <select
            id="admin-status"
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
          <label htmlFor="admin-limit">Par page</label>
          <select
            id="admin-limit"
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
            <th>Email</th>
            <th>Téléphone</th>
            <th>Statut</th>
            <th>Créé le</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(result?.data ?? []).map((admin) => (
            <tr key={admin.id}>
              <td>{admin.id}</td>
              <td>{admin.email ?? '—'}</td>
              <td>{admin.phone}</td>
              <td>
                {admin.isAvailable === false ? (
                  <span className="alert warning" style={{ padding: '4px 8px', margin: 0 }}>
                    Désactivé
                  </span>
                ) : (
                  <span style={{ color: '#155724' }}>Actif</span>
                )}
              </td>
              <td>{new Date(admin.createdAt).toLocaleDateString('fr-FR')}</td>
              <td>
                <button
                  type="button"
                  className="secondary"
                  style={{ padding: '5px 10px', fontSize: '12px', marginRight: 6 }}
                  onClick={() =>
                    toggleAvailability(admin, admin.isAvailable === false)
                  }
                >
                  {admin.isAvailable === false ? 'Activer' : 'Désactiver'}
                </button>
                <button
                  type="button"
                  className="danger"
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                  onClick={() => handleDelete(admin.id)}
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

export default AdminsPage;
