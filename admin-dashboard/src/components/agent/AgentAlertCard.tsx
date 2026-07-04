import React from 'react';
import { Link } from 'react-router-dom';
import type { ReferentReclamationRow } from '@/types/agent';
import { TicketStatusBadge } from '@components/bailleur/TicketStatusBadge';
import { UrgencyBadge } from '@components/agent/UrgencyBadge';

interface AgentAlertCardProps {
  row: ReferentReclamationRow;
}

export const AgentAlertCard: React.FC<AgentAlertCardProps> = ({ row }) => {
  const tenantName = `${row.tenant.firstName} ${row.tenant.lastName}`.trim();
  const isLate = row.joursSansTraitement > 0;

  return (
    <Link to={`/agent/tickets/${row.id}`} className="agent-alert-card">
      <div className="agent-alert-card__top">
        <span
          className={
            isLate ? 'agent-alert-card__delay agent-alert-card__delay--late' : 'agent-alert-card__delay'
          }
        >
          {isLate ? row.affichageRetard : 'À jour'}
        </span>
        <UrgencyBadge severity={row.aiSeverity} />
      </div>
      <h3 className="agent-alert-card__title">{row.title}</h3>
      <p className="agent-alert-card__meta">
        <span>{row.metier}</span>
        <span aria-hidden>·</span>
        <span>{row.housing?.address ?? 'Logement —'}</span>
      </p>
      <p className="agent-alert-card__tenant">{tenantName || 'Locataire'}</p>
      <div className="agent-alert-card__footer">
        <code className="agent-alert-card__ref">
          {row.caseNumber ?? `#${row.id}`}
        </code>
        <TicketStatusBadge status={row.status} />
        <span className="agent-alert-card__cta">Mission →</span>
      </div>
    </Link>
  );
};
