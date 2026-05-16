import React from 'react';
import { Link } from 'react-router-dom';
import type { LandlordDashboard, TicketResponsibilityUi } from '@/types/bailleur';
import { ResponsibilityBadge } from './ResponsibilityBadge';
import { TicketList } from './TicketList';
import './bailleur.css';

const RESP_ORDER: TicketResponsibilityUi[] = [
  'ESCALADE_BAILLEUR',
  'PENDING',
  'BAILLEUR',
  'LOCATAIRE',
  'SOCIAL',
  'NON_RECEVABLE',
];

interface Props {
  dashboard: LandlordDashboard;
}

export const LandlordDashboardPanels: React.FC<Props> = ({ dashboard }) => {
  const { ticketsByResponsibility, escalations, ai } = dashboard;

  return (
    <>
      {(escalations.active > 0 || escalations.awaitingAi > 0) && (
        <section className="bailleur-dash-section bailleur-alert-banner">
          <h2>Alertes IA</h2>
          <p>
            {escalations.active > 0 && (
              <strong>{escalations.active} escalade(s)</strong>
            )}
            {escalations.active > 0 && escalations.awaitingAi > 0 && ' · '}
            {escalations.awaitingAi > 0 && (
              <span>{escalations.awaitingAi} ticket(s) en analyse IA</span>
            )}
          </p>
          <Link
            to="/bailleur/tickets?responsibility=ESCALADE_BAILLEUR"
            className="bailleur-card__link"
          >
            Voir les escalades →
          </Link>
        </section>
      )}

      <section className="bailleur-dash-section">
        <h2>Tickets par responsabilité</h2>
        <div className="bailleur-resp-grid">
          {RESP_ORDER.map((key) => (
            <Link
              key={key}
              to={`/bailleur/tickets?responsibility=${key}`}
              className="bailleur-resp-card"
            >
              <ResponsibilityBadge responsibility={key} />
              <span className="bailleur-resp-card__count">
                {ticketsByResponsibility[key] ?? 0}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bailleur-dash-section">
        <h2>Statistiques IA</h2>
        <div className="bailleur-stat-grid">
          <div className="bailleur-stat">
            <div className="bailleur-stat__title">Tickets routés</div>
            <div className="bailleur-stat__value">{ai.routedCount}</div>
          </div>
          <div className="bailleur-stat">
            <div className="bailleur-stat__title">Confiance moyenne</div>
            <div className="bailleur-stat__value">
              {ai.avgConfidence != null
                ? `${Math.round(ai.avgConfidence * 100)} %`
                : '—'}
            </div>
          </div>
          <div className="bailleur-stat">
            <div className="bailleur-stat__title">Non recevables</div>
            <div className="bailleur-stat__value">{ai.nonRecevableCount}</div>
          </div>
        </div>
        {Object.keys(ai.byCategory).length > 0 && (
          <ul className="bailleur-mini-list">
            {Object.entries(ai.byCategory)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([cat, n]) => (
                <li key={cat}>
                  <span>{cat}</span>
                  <span className="muted">{n}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      {escalations.recent.length > 0 && (
        <section className="bailleur-dash-section">
          <h2>Escalades récentes</h2>
          <TicketList tickets={escalations.recent} emptyLabel="Aucune escalade." />
        </section>
      )}

      <section className="bailleur-dash-section">
        <h2>Derniers tickets</h2>
        <TicketList tickets={dashboard.recentTickets} />
        <p style={{ marginTop: 12 }}>
          <Link to="/bailleur/tickets" className="bailleur-card__link">
            Tous les tickets →
          </Link>
        </p>
      </section>
    </>
  );
};
