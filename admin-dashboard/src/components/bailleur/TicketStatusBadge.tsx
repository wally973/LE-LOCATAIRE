import React from 'react';
import './bailleur.css';

const LABELS: Record<string, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
  CANCELLED: 'Clos',
};

interface Props {
  status: string;
}

export const TicketStatusBadge: React.FC<Props> = ({ status }) => {
  const key = String(status).toUpperCase();
  const label = LABELS[key] ?? status;
  const cls = key.toLowerCase().replace(/_/g, '-');

  return (
    <span className={`bailleur-ticket-badge bailleur-ticket-badge--${cls}`}>
      {label}
    </span>
  );
};
