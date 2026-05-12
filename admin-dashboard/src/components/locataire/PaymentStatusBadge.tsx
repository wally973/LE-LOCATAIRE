import React from 'react';
import './locataire.css';

interface Props {
  status: string;
}

export const PaymentStatusBadge: React.FC<Props> = ({ status }) => {
  const k = String(status).toUpperCase();
  let cls = 'pay-badge--pending';
  if (k === 'AVAILABLE' || k === 'PAID') cls = 'pay-badge--available';
  const label =
    k === 'AVAILABLE'
      ? 'Disponible'
      : k === 'PENDING'
        ? 'En attente'
        : status;
  return <span className={`pay-badge ${cls}`}>{label}</span>;
};
