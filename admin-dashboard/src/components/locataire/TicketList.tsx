import React from 'react';
import { Link } from 'react-router-dom';
import type { TenantTicketRow } from '@/types/locataire';
import { TicketStatusBadge } from './TicketStatusBadge';
import './locataire.css';

interface Props {
  tickets: TenantTicketRow[];
  emptyLabel?: string;
}

export const TicketList: React.FC<Props> = ({
  tickets,
  emptyLabel = 'Aucun ticket.',
}) => {
  if (!tickets.length) {
    return <p style={{ color: '#64748b' }}>{emptyLabel}</p>;
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {tickets.map((t) => (
        <li
          key={t.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 0',
            borderBottom: '1px solid #e2e8f0',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <strong>{t.title}</strong>
            <div style={{ marginTop: 6 }}>
              <TicketStatusBadge status={t.status} />
              <span style={{ marginLeft: 10, color: '#64748b', fontSize: 13 }}>
                {new Date(t.createdAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
          <Link to={`/locataire/tickets/${t.id}`}>Voir</Link>
        </li>
      ))}
    </ul>
  );
};
