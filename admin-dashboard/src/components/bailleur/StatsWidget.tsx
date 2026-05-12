import React from 'react';
import type { BailleurStats } from '@/types/bailleur';
import './bailleur.css';

interface Props {
  title: string;
  value: React.ReactNode;
  hint?: string;
  variant?: 'default' | 'accent' | 'warn';
}

export const StatsWidget: React.FC<Props> = ({
  title,
  value,
  hint,
  variant = 'default',
}) => (
  <div className={`bailleur-stat bailleur-stat--${variant}`}>
    <div className="bailleur-stat__title">{title}</div>
    <div className="bailleur-stat__value">{value}</div>
    {hint ? <div className="bailleur-stat__hint">{hint}</div> : null}
  </div>
);

interface GridProps {
  stats: BailleurStats;
}

export const StatsWidgetGrid: React.FC<GridProps> = ({ stats }) => (
  <div className="bailleur-stat-grid">
    <StatsWidget title="Logements" value={stats.housingCount} />
    <StatsWidget title="Locataires actifs" value={stats.tenantCount} />
    <StatsWidget
      title="Tickets ouverts / en cours"
      value={stats.openTickets}
      variant={stats.openTickets > 0 ? 'warn' : 'default'}
    />
    <StatsWidget
      title="Factures payées"
      value={stats.invoicePaid}
      hint={`${stats.invoicePending} en attente sur ${stats.invoiceTotal} au total`}
      variant="accent"
    />
  </div>
);
