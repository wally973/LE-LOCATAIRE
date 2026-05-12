import React from 'react';
import { Link } from 'react-router-dom';
import type { BailleurHousing } from '@/types/bailleur';
import './bailleur.css';

interface Props {
  housing: BailleurHousing;
}

export const HousingCard: React.FC<Props> = ({ housing }) => {
  const tenant = housing.currentTenant;
  const ticketCount = housing.tickets?.length ?? 0;

  return (
    <article className="bailleur-card bailleur-card--housing">
      <header>
        <h3>{housing.address}</h3>
        <span className="bailleur-card__meta">
          {housing.postalCode} {housing.city}
        </span>
      </header>
      <p className="bailleur-card__line">
        {tenant ? (
          <>
            Locataire :{' '}
            <strong>
              {tenant.firstName} {tenant.lastName}
            </strong>
          </>
        ) : (
          <em>Logement vacant</em>
        )}
      </p>
      <p className="bailleur-card__line">
        Tickets liés : <strong>{ticketCount}</strong>
      </p>
      <Link
        to={`/bailleur/logements/${housing.id}`}
        className="bailleur-card__link"
      >
        Voir le détail →
      </Link>
    </article>
  );
};
