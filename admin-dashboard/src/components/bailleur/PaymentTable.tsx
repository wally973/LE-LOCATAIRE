import React from 'react';
import type { BailleurInvoice } from '@/types/bailleur';
import './bailleur.css';

interface Props {
  rows: BailleurInvoice[];
  emptyLabel?: string;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
}

export const PaymentTable: React.FC<Props> = ({
  rows,
  emptyLabel = 'Aucune facture pour le moment.',
}) => {
  if (!rows.length) {
    return <p className="bailleur-empty">{emptyLabel}</p>;
  }

  return (
    <div className="bailleur-table-wrap">
      <table className="bailleur-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Montant</th>
            <th>Statut</th>
            <th>Date</th>
            <th>Logement</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.id}</td>
              <td>{inv.amount.toFixed(2)} €</td>
              <td>
                <span
                  className={`bailleur-pill bailleur-pill--${inv.status.toLowerCase()}`}
                >
                  {inv.status}
                </span>
              </td>
              <td>{formatDate(inv.createdAt)}</td>
              <td>
                {inv.slot?.ticket?.housing
                  ? `${inv.slot.ticket.housing.address}, ${inv.slot.ticket.housing.city}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
