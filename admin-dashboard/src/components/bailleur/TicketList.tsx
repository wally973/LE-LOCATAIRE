import React from 'react';
import { Link } from 'react-router-dom';
import type { BailleurTicket } from '@/types/bailleur';
import { TicketStatusBadge } from './TicketStatusBadge';
import './bailleur.css';

interface Props {
  tickets: BailleurTicket[];
  ticketLinkPrefix?: string;
  emptyLabel?: string;
}

export const TicketList: React.FC<Props> = ({
  tickets,
  ticketLinkPrefix = '/bailleur/tickets',
  emptyLabel = 'Aucun ticket.',
}) => {
  if (!tickets.length) {
    return <p className="bailleur-empty">{emptyLabel}</p>;
  }

  return (
    <ul className="bailleur-ticket-list">
      {tickets.map((t) => (
        <li key={t.id} className="bailleur-ticket-list__item">
          <div>
            <strong>{t.title}</strong>
            <div className="bailleur-ticket-list__meta">
              <TicketStatusBadge status={t.status} />
              <span>{new Date(t.createdAt).toLocaleDateString('fr-FR')}</span>
              {t.housing?.address ? (
                <span className="muted">{t.housing.address}</span>
              ) : null}
            </div>
          </div>
          <Link
            to={`${ticketLinkPrefix}/${t.id}`}
            className="bailleur-card__link"
          >
            Ouvrir
          </Link>
        </li>
      ))}
    </ul>
  );
};
