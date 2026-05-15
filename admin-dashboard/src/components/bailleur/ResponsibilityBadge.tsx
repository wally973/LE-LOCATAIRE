import React from 'react';
import type { TicketResponsibilityUi } from '@/types/bailleur';
import './bailleur.css';

const LABELS: Record<TicketResponsibilityUi, string> = {
  PENDING: 'IA en attente',
  BAILLEUR: 'Charge bailleur',
  LOCATAIRE: 'Charge locataire',
  NON_RECEVABLE: 'Non recevable',
  SOCIAL: 'Social',
  ESCALADE_BAILLEUR: 'Escalade IA',
};

const VARIANT: Record<TicketResponsibilityUi, string> = {
  PENDING: 'pending',
  BAILLEUR: 'bailleur',
  LOCATAIRE: 'locataire',
  NON_RECEVABLE: 'non-recevable',
  SOCIAL: 'social',
  ESCALADE_BAILLEUR: 'escalade',
};

interface Props {
  responsibility: TicketResponsibilityUi | string;
}

export const ResponsibilityBadge: React.FC<Props> = ({ responsibility }) => {
  const key = String(responsibility) as TicketResponsibilityUi;
  const variant = VARIANT[key] ?? 'pending';
  const label = LABELS[key] ?? responsibility;

  return (
    <span className={`bailleur-resp bailleur-resp--${variant}`}>{label}</span>
  );
};
