import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '@services/agentApi';
import { getErrorMessage } from '@services/apiClient';
import type { ReferentReclamationRow } from '@/types/agent';
import { TicketStatusBadge } from '@components/bailleur/TicketStatusBadge';
import '@components/bailleur/bailleur.css';

const AgentReclamationsPage: React.FC = () => {
  const [scopeLabel, setScopeLabel] = useState('');
  const [rows, setRows] = useState<ReferentReclamationRow[]>([]);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    agentApi
      .getReclamations(onlyOpen)
      .then((data) => {
        setScopeLabel(data.scopeLabel);
        setRows(data.items);
      })
      .catch((e) => setErr(getErrorMessage(e, 'Erreur de chargement')))
      .finally(() => setLoading(false));
  }, [onlyOpen]);

  return (
    <div className="container">
      <h1>Réclamations — mon secteur</h1>
      <p style={{ color: '#64748b', maxWidth: 720 }}>
        Périmètre : <strong>{scopeLabel}</strong>. Les affaires non traitées
        depuis plusieurs jours apparaissent en <span className="retard-jours--alert">+N</span>{' '}
        (rouge).
      </p>

      <div className="bailleur-filter-bar" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={
            onlyOpen
              ? 'bailleur-filter-btn bailleur-filter-btn--active'
              : 'bailleur-filter-btn'
          }
          onClick={() => setOnlyOpen(true)}
        >
          En cours
        </button>
        <button
          type="button"
          className={
            !onlyOpen
              ? 'bailleur-filter-btn bailleur-filter-btn--active'
              : 'bailleur-filter-btn'
          }
          onClick={() => setOnlyOpen(false)}
        >
          Toutes
        </button>
      </div>

      {err ? <div className="alert error">{err}</div> : null}
      {loading ? (
        <p>Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="bailleur-empty">Aucune réclamation sur ce périmètre.</p>
      ) : (
        <div className="bailleur-table-wrap">
          <table className="bailleur-table">
            <thead>
              <tr>
                <th>Jours</th>
                <th>Dossier</th>
                <th>Affaire</th>
                <th>Métier</th>
                <th>Logement</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span
                      className={
                        row.joursSansTraitement > 0
                          ? 'retard-jours--alert'
                          : 'retard-jours--ok'
                      }
                    >
                      {row.affichageRetard}
                    </span>
                  </td>
                  <td>
                    <code>{row.dossierNumber ?? '—'}</code>
                  </td>
                  <td>
                    <code>{row.caseNumber ?? `#${row.id}`}</code>
                  </td>
                  <td>{row.metier}</td>
                  <td className="muted" style={{ maxWidth: 200 }}>
                    {row.housing?.address ?? '—'}
                  </td>
                  <td>
                    <TicketStatusBadge status={row.status} />
                  </td>
                  <td>
                    <Link
                      to={`/agent/tickets/${row.id}`}
                      className="bailleur-card__link"
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AgentReclamationsPage;
