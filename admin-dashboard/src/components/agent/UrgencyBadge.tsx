import React from 'react';

type UrgencyLevel = 'danger' | 'urgent' | 'priority' | 'normal';

function resolveUrgency(severity: string | null | undefined): UrgencyLevel {
  const s = (severity ?? '').toUpperCase();
  if (s === 'CRITICAL' || s === 'DANGER') return 'danger';
  if (s === 'HIGH' || s === 'URGENT') return 'urgent';
  if (s === 'MEDIUM') return 'priority';
  return 'normal';
}

const LABELS: Record<UrgencyLevel, string> = {
  danger: 'Danger',
  urgent: 'Urgent',
  priority: 'Prioritaire',
  normal: 'À qualifier',
};

interface UrgencyBadgeProps {
  severity?: string | null;
}

export const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({ severity }) => {
  const level = resolveUrgency(severity);
  return (
    <span className={`agent-urgency agent-urgency--${level}`}>
      {LABELS[level]}
    </span>
  );
};

export function urgencyRank(severity: string | null | undefined): number {
  const order: Record<UrgencyLevel, number> = {
    danger: 4,
    urgent: 3,
    priority: 2,
    normal: 1,
  };
  return order[resolveUrgency(severity)];
}
