import React from 'react';

const AdminPaymentsPage: React.FC = () => (
  <div className="container">
    <h1>Paiements &amp; facturation (admin)</h1>
    <div className="card">
      <p>
        Vue consolidée des encaissements, retards et exports comptables : à
        brancher sur les futurs endpoints de synthèse (agrégation factures /
        loyers).
      </p>
      <p style={{ color: '#666' }}>
        Stripe et relances automatiques seront intégrés côté backend puis
        exposés ici.
      </p>
    </div>
  </div>
);

export default AdminPaymentsPage;
