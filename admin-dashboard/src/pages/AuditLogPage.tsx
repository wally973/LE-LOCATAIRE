import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import adminApi, { AuditLogEntry, PaginatedResponse } from '@services/adminApi';
import { canAccessAudit } from '@auth/roles';

/**
 * Consultation du journal d’audit des actions administrateur.
 */
const AuditLogPage: React.FC = () => {
  const [result, setResult] = useState<PaginatedResponse<AuditLogEntry> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const limit = 25;

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminApi.getAuditLogs({
        page,
        limit,
        search: search || undefined,
      });
      setResult(data);
    } catch {
      setError('Impossible de charger le journal d’audit');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (!canAccessAudit()) return <Navigate to="/admin/dashboard" replace />;

  if (loading && !result) return <div className="container">Chargement...</div>;

  return (
    <div className="container">
      <h1>Journal d&apos;audit</h1>
      <p style={{ color: '#555', maxWidth: 720 }}>
        Historique des actions effectuées depuis l&apos;espace administrateur
        (créations, modifications, désactivations, etc.).
      </p>

      <div className="form-group" style={{ maxWidth: 400 }}>
        <label htmlFor="audit-search">Recherche (action, type d&apos;entité)</label>
        <input
          id="audit-search"
          type="search"
          placeholder="Ex. CREATE_ADMIN, USER…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error ? <div className="alert error">{error}</div> : null}

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Acteur</th>
            <th>Action</th>
            <th>Entité</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {(result?.data ?? []).map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.createdAt).toLocaleString('fr-FR')}</td>
              <td>
                {row.actorEmail ?? row.actor?.email ?? `User #${row.actorId}`}
              </td>
              <td>
                <code>{row.action}</code>
              </td>
              <td>{row.entityType}</td>
              <td>{row.entityId ?? '—'}</td>
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
            {result.meta.total} entrée(s) — page {result.meta.page} /{' '}
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

export default AuditLogPage;
