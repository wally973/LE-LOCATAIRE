import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '@services/agentApi';
import { getErrorMessage } from '@services/apiClient';
import type { ReferentReclamationRow } from '@/types/agent';
import { TicketStatusBadge } from '@components/bailleur/TicketStatusBadge';
import { AgentAlertCard } from '@components/agent/AgentAlertCard';
import { UrgencyBadge, urgencyRank } from '@components/agent/UrgencyBadge';
import '@components/bailleur/bailleur.css';
import './agent-sector.css';

type AlertTab = 'priorite' | 'retard' | 'recent' | 'urgent';
type ViewMode = 'cards' | 'table';

const PAGE_SIZE = 24;

const TABS: { id: AlertTab; label: string; hint: string }[] = [
  { id: 'priorite', label: 'Priorité', hint: 'Tri urgence + retard' },
  { id: 'retard', label: 'En retard', hint: '+N jours' },
  { id: 'recent', label: 'Récentes', hint: 'Sans retard affiché' },
  { id: 'urgent', label: 'Urgent', hint: 'Haute priorité / danger' },
];

function sortRows(rows: ReferentReclamationRow[]) {
  return [...rows].sort((a, b) => {
    const u = urgencyRank(b.aiSeverity) - urgencyRank(a.aiSeverity);
    if (u !== 0) return u;
    return b.joursSansTraitement - a.joursSansTraitement;
  });
}

function filterTab(rows: ReferentReclamationRow[], tab: AlertTab) {
  switch (tab) {
    case 'retard':
      return rows.filter((r) => r.joursSansTraitement > 0);
    case 'recent':
      return rows.filter((r) => r.joursSansTraitement === 0);
    case 'urgent':
      return rows.filter((r) => urgencyRank(r.aiSeverity) >= urgencyRank('HIGH'));
    default:
      return rows;
  }
}

function matchSearch(row: ReferentReclamationRow, q: string) {
  if (!q.trim()) return true;
  const hay = [
    row.title,
    row.metier,
    row.caseNumber,
    row.dossierNumber,
    row.housing?.address,
    row.tenant.firstName,
    row.tenant.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

const AgentReclamationsPage: React.FC = () => {
  const [scopeLabel, setScopeLabel] = useState('');
  const [rows, setRows] = useState<ReferentReclamationRow[]>([]);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [tab, setTab] = useState<AlertTab>('priorite');
  const [view, setView] = useState<ViewMode>('cards');
  const [search, setSearch] = useState('');
  const [metier, setMetier] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    agentApi
      .getReclamations(onlyOpen)
      .then((data) => {
        setScopeLabel(data.scopeLabel);
        setRows(data.items);
        setVisibleCount(PAGE_SIZE);
      })
      .catch((e) => {
        const msg = getErrorMessage(e, 'Erreur de chargement');
        if (/internal server error/i.test(msg)) {
          setErr(
            'Erreur serveur — la base est peut-être désynchronisée. Lancez « npx prisma migrate deploy » dans mon-backend/backend.',
          );
        } else {
          setErr(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [onlyOpen]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, search, metier, onlyOpen]);

  const stats = useMemo(() => {
    const sorted = sortRows(rows);
    return {
      total: rows.length,
      retard: rows.filter((r) => r.joursSansTraitement > 0).length,
      recent: rows.filter((r) => r.joursSansTraitement === 0).length,
      urgent: rows.filter((r) => urgencyRank(r.aiSeverity) >= urgencyRank('HIGH'))
        .length,
    };
  }, [rows]);

  const metiers = useMemo(() => {
    const set = new Set(rows.map((r) => r.metier).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rows]);

  const filtered = useMemo(() => {
    let list = filterTab(rows, tab);
    if (metier) list = list.filter((r) => r.metier === metier);
    if (search.trim()) list = list.filter((r) => matchSearch(r, search));
    return sortRows(list);
  }, [rows, tab, metier, search]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="container agent-alerts-page">
      <header className="agent-alerts-header">
        <div>
          <h1>Mes alertes</h1>
          <p className="agent-intro">
            Secteur <strong>{scopeLabel || '—'}</strong> — vous contactez le
            locataire et organisez l’intervention. L’app ne planifie pas les
            prestataires.
          </p>
        </div>
        <span className="agent-sector-pill">{scopeLabel || 'Secteur'}</span>
      </header>

      <div className="agent-kpi-grid agent-kpi-grid--clickable">
        <button
          type="button"
          className={`bailleur-stat agent-kpi-btn ${tab === 'priorite' ? 'agent-kpi-btn--active' : ''}`}
          onClick={() => setTab('priorite')}
        >
          <div className="bailleur-stat__title">À traiter</div>
          <div className="bailleur-stat__value">{stats.total}</div>
          <div className="bailleur-stat__hint">Toutes alertes ouvertes</div>
        </button>
        <button
          type="button"
          className={`bailleur-stat bailleur-stat--warn agent-kpi-btn ${tab === 'retard' ? 'agent-kpi-btn--active' : ''}`}
          onClick={() => setTab('retard')}
        >
          <div className="bailleur-stat__title">En retard</div>
          <div className="bailleur-stat__value">{stats.retard}</div>
          <div className="bailleur-stat__hint">+N jours sans action</div>
        </button>
        <button
          type="button"
          className={`bailleur-stat agent-kpi-btn ${tab === 'recent' ? 'agent-kpi-btn--active' : ''}`}
          onClick={() => setTab('recent')}
        >
          <div className="bailleur-stat__title">Récentes</div>
          <div className="bailleur-stat__value">{stats.recent}</div>
          <div className="bailleur-stat__hint">Retard affiché : 0</div>
        </button>
        <button
          type="button"
          className={`bailleur-stat bailleur-stat--accent agent-kpi-btn ${tab === 'urgent' ? 'agent-kpi-btn--active' : ''}`}
          onClick={() => setTab('urgent')}
        >
          <div className="bailleur-stat__title">Urgent</div>
          <div className="bailleur-stat__value">{stats.urgent}</div>
          <div className="bailleur-stat__hint">Danger ou haute priorité</div>
        </button>
      </div>

      <nav className="agent-tabs" aria-label="Filtres alertes">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`agent-tab ${tab === t.id ? 'agent-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="agent-tab__hint">{t.hint}</span>
          </button>
        ))}
      </nav>

      <div className="agent-toolbar">
        <input
          type="search"
          className="agent-search"
          placeholder="Rechercher affaire, adresse, locataire…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher"
        />
        <select
          className="agent-metier-select"
          value={metier}
          onChange={(e) => setMetier(e.target.value)}
          aria-label="Filtrer par métier"
        >
          <option value="">Tous métiers</option>
          {metiers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="agent-toolbar__right">
          <div className="bailleur-filter-bar agent-toolbar__toggle">
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
          <div className="bailleur-filter-bar">
            <button
              type="button"
              className={
                view === 'cards'
                  ? 'bailleur-filter-btn bailleur-filter-btn--active'
                  : 'bailleur-filter-btn'
              }
              onClick={() => setView('cards')}
            >
              Cartes
            </button>
            <button
              type="button"
              className={
                view === 'table'
                  ? 'bailleur-filter-btn bailleur-filter-btn--active'
                  : 'bailleur-filter-btn'
              }
              onClick={() => setView('table')}
            >
              Tableau
            </button>
          </div>
        </div>
      </div>

      {err ? <div className="alert error">{err}</div> : null}

      {loading ? (
        <p className="agent-loading">Chargement des alertes…</p>
      ) : filtered.length === 0 ? (
        <div className="agent-empty-state">
          <p>Aucune alerte pour cet onglet.</p>
          {tab !== 'priorite' ? (
            <button type="button" className="secondary" onClick={() => setTab('priorite')}>
              Voir toutes les priorités
            </button>
          ) : null}
        </div>
      ) : view === 'cards' ? (
        <>
          <div className="agent-alert-grid">
            {visible.map((row) => (
              <AgentAlertCard key={row.id} row={row} />
            ))}
          </div>
          {visibleCount < filtered.length ? (
            <div className="agent-load-more">
              <button
                type="button"
                className="secondary"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                Afficher plus ({filtered.length - visibleCount} restantes)
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="bailleur-table-wrap">
          <table className="bailleur-table agent-compact-table">
            <thead>
              <tr>
                <th>Retard</th>
                <th>Urgence</th>
                <th>Signalement</th>
                <th>Métier</th>
                <th>Locataire</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
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
                    <UrgencyBadge severity={row.aiSeverity} />
                  </td>
                  <td>
                    <strong>{row.title}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      <code>{row.caseNumber ?? `#${row.id}`}</code>
                    </div>
                  </td>
                  <td>{row.metier}</td>
                  <td className="muted">
                    {row.tenant.firstName} {row.tenant.lastName}
                  </td>
                  <td>
                    <TicketStatusBadge status={row.status} />
                  </td>
                  <td>
                    <Link to={`/agent/tickets/${row.id}`} className="bailleur-card__link">
                      Mission
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 ? (
        <p className="agent-result-count">
          {Math.min(visibleCount, filtered.length)} / {filtered.length} affaire
          {filtered.length > 1 ? 's' : ''} — onglet « {TABS.find((t) => t.id === tab)?.label} »
        </p>
      ) : null}
    </div>
  );
};

export default AgentReclamationsPage;
