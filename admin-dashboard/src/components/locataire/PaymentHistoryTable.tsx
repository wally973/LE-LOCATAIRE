import React from 'react';
import { Link } from 'react-router-dom';
import type { TenantPaymentRow } from '@/types/locataire';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import './locataire.css';

interface Props {
  rows: TenantPaymentRow[];
  emptyLabel?: string;
}

export const PaymentHistoryTable: React.FC<Props> = ({
  rows,
  emptyLabel = 'Aucun document pour le moment.',
}) => {
  if (!rows.length) {
    return <p style={{ color: '#64748b' }}>{emptyLabel}</p>;
  }

  return (
    <div className="loca-table-wrap" data-coach="payments-table">
      <table className="loca-table">
        <thead>
          <tr>
            <th>Réf.</th>
            <th>Libellé</th>
            <th>Statut</th>
            <th>Date</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.label}</td>
              <td>
                <PaymentStatusBadge status={r.status} />
              </td>
              <td>
                {new Date(r.createdAt).toLocaleDateString('fr-FR')}
              </td>
              <td>
                <Link to={`/locataire/paiements/${r.id}`}>Détail</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
