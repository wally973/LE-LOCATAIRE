import React from 'react';
import './locataire.css';

interface Props {
  title: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}

export const DashboardCard: React.FC<Props> = ({ title, value, children }) => (
  <div className="loca-card">
    <h3>{title}</h3>
    <div className="loca-card__value">{value}</div>
    {children}
  </div>
);
