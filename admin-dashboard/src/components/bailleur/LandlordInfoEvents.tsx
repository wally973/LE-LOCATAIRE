import React from 'react';
import type { LandlordInfoEvent } from '@/types/bailleur';
import './bailleur.css';

interface Props {
  events: LandlordInfoEvent[];
  compact?: boolean;
}

const kindClass: Record<LandlordInfoEvent['kind'], string> = {
  DIAGNOSTIC_LOCATAIRE: 'landlord-info--tenant',
  ARTISAN_DECLINED: 'landlord-info--declined',
  ARTISAN_REQUESTED: 'landlord-info--artisan',
  EXPERT_RECTIFIED: 'landlord-info--expert',
};

export const LandlordInfoEvents: React.FC<Props> = ({ events, compact }) => {
  if (!events.length) return null;

  return (
    <ul className={`landlord-info-list${compact ? ' landlord-info-list--compact' : ''}`}>
      {events.map((ev, i) => (
        <li key={`${ev.kind}-${ev.at}-${i}`} className={`landlord-info-item ${kindClass[ev.kind]}`}>
          <div className="landlord-info-item__head">
            <span className="landlord-info-item__date">
              {new Date(ev.at).toLocaleString('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
            <strong>{ev.label}</strong>
          </div>
          <p className="landlord-info-item__detail">{ev.detail}</p>
        </li>
      ))}
    </ul>
  );
};
