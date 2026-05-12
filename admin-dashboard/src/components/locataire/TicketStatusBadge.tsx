import React from 'react';
import './locataire.css';

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
    <span className={`ticket-badge-lo ticket-badge-lo--${cls}`}>{label}</span>
  );
};
