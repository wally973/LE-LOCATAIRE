import React from 'react';
import { Link } from 'react-router-dom';
import type { BailleurTenantWithHousing } from '@/types/bailleur';
import './bailleur.css';

interface Props {
  row: BailleurTenantWithHousing;
}

export const TenantCard: React.FC<Props> = ({ row }) => {
  const { tenant, housing } = row;
  const email = tenant.user?.email;

  return (
    <article className="bailleur-card bailleur-card--tenant">
      <header>
        <h3>
          {tenant.firstName} {tenant.lastName}
        </h3>
      </header>
      <p className="bailleur-card__line">
        Logement : {housing.address}, {housing.city}
      </p>
      {email ? (
        <p className="bailleur-card__line">{email}</p>
      ) : (
        <p className="bailleur-card__line muted">Email non renseigné</p>
      )}
      <Link
        to={`/bailleur/locataires/${tenant.id}`}
        className="bailleur-card__link"
      >
        Fiche locataire →
      </Link>
    </article>
  );
};
