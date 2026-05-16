import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketsApi } from '@services/ticketsApi';
import { getErrorMessage } from '@services/apiClient';
import type { DossierLookupResult } from '@/types/bailleur';
import { TicketList } from '@components/bailleur/TicketList';
import { ResponsibilityBadge } from '@components/bailleur/ResponsibilityBadge';
import { TicketStatusBadge } from '@components/bailleur/TicketStatusBadge';
import '@components/bailleur/bailleur.css';

/**
 * Recherche d’un dossier par numéro d’affaire (AFF) ou dossier locataire (DOS).
 */
const LandlordCaseSearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DossierLookupResult | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = query.trim().toUpperCase().replace(/\s+/g, '');
    if (!ref) {
      setErr('Saisissez un numéro AFF-… ou DOS-…');
      return;
    }

    setLoading(true);
    setErr('');
    setResult(null);

    try {
      const data = ref.startsWith('DOS-')
        ? await ticketsApi.lookupByDossier(ref)
        : await ticketsApi.lookupByCase(ref);
      setResult(data);
    } catch (ex) {
      setErr(getErrorMessage(ex, 'Dossier introuvable'));
    } finally {
      setLoading(false);
    }
  };

  const tenant = result?.tenant;
  const focusTicket = result?.focusTicket;

  return (
    <div className="container">
      <h1>Recherche dossier</h1>
      <p style={{ color: '#64748b', maxWidth: 640 }}>
        Saisissez le <strong>numéro d&apos;affaire</strong> (ex. AFF-2026-000128)
        reçu par le locataire, ou le <strong>numéro de dossier</strong> locataire
        (ex. DOS-000042).
      </p>

      <form className="bailleur-search-form" onSubmit={runSearch}>
        <input
          type="search"
          className="bailleur-search-input"
          placeholder="AFF-2026-000128 ou DOS-000042"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="bailleur-search-btn" disabled={loading}>
          {loading ? 'Recherche…' : 'Ouvrir le dossier'}
        </button>
      </form>

      {err ? <div className="alert error">{err}</div> : null}

      {result && tenant ? (
        <div className="bailleur-search-results">
          <section className="bailleur-card bailleur-search-tenant">
            <h2>Locataire</h2>
            <p className="bailleur-card__line">
              <strong>
                {tenant.firstName} {tenant.lastName}
              </strong>
            </p>
            <p className="bailleur-card__meta">
              Dossier{' '}
              <code>{tenant.dossierNumber ?? result.dossierNumber ?? '—'}</code>
            </p>
            {tenant.email ? (
              <p className="bailleur-card__line">
                Email : <a href={`mailto:${tenant.email}`}>{tenant.email}</a>
              </p>
            ) : null}
            {tenant.phone ? (
              <p className="bailleur-card__line">Tél. : {tenant.phone}</p>
            ) : null}
            {tenant.housing ? (
              <p className="bailleur-card__line muted">
                Logement actuel : {tenant.housing.address},{' '}
                {tenant.housing.postalCode} {tenant.housing.city}
                {tenant.housing.residenceUnitNumber ? (
                  <>
                    {' '}
                    (<code>{tenant.housing.residenceUnitNumber}</code>)
                  </>
                ) : null}
              </p>
            ) : null}
            <p style={{ marginTop: 12 }}>
              <Link
                to={`/bailleur/locataires/${tenant.id}`}
                className="bailleur-card__link"
              >
                Fiche locataire →
              </Link>
            </p>
          </section>

          {focusTicket ? (
            <section className="bailleur-card">
              <h2>Affaire consultée</h2>
              <p className="bailleur-card__line">
                <code>{focusTicket.caseNumber ?? `Ticket #${focusTicket.id}`}</code>
                {' — '}
                {focusTicket.title}
              </p>
              <div className="bailleur-ticket-list__meta" style={{ marginTop: 8 }}>
                <TicketStatusBadge status={focusTicket.status} />
                {focusTicket.responsibility ? (
                  <ResponsibilityBadge responsibility={focusTicket.responsibility} />
                ) : null}
              </div>
              <p style={{ marginTop: 12 }}>
                <Link
                  to={`/bailleur/tickets/${focusTicket.id}`}
                  className="bailleur-card__link"
                >
                  Ouvrir l&apos;affaire →
                </Link>
              </p>
            </section>
          ) : null}

          {result.occupancyHistory && result.occupancyHistory.length > 0 ? (
            <section>
              <h2>Historique des logements</h2>
              <ul className="bailleur-mini-list">
                {result.occupancyHistory.map((row) => (
                  <li key={row.id}>
                    <span>
                      {row.address}
                      {row.residenceUnitNumber ? (
                        <> — <code>{row.residenceUnitNumber}</code></>
                      ) : null}
                      {row.isCurrent ? ' (actuel)' : ''}
                    </span>
                    <span className="muted">
                      {row.endedLabel ??
                        `Depuis le ${new Date(row.from).toLocaleDateString('fr-FR')}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2>Historique des demandes ({result.totalTickets})</h2>
            <TicketList tickets={result.ticketHistory} />
            {result.ticketHistory.some((t) => t.housingLabel) ? (
              <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                Les demandes marquées « ancien logement » ont été ouvertes avant un
                déménagement.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default LandlordCaseSearchPage;
