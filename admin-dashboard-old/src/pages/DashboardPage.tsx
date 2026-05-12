import React, { useEffect, useState } from 'react';
import adminApi, { DashboardData } from '../services/adminApi';
import './DashboardPage.css';

function maxTrendValue(days: { newTickets: number; newUsers: number }[]): number {
  return Math.max(1, ...days.flatMap((d) => [d.newTickets, d.newUsers]));
}

/**
 * Tableau de bord synthétique : KPIs, tendances sur 7 jours et listes récentes.
 */
const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const dashboard = await adminApi.getDashboard();
        setData(dashboard);
      } catch {
        setError('Erreur lors du chargement du dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <div className="container">Chargement...</div>;
  if (error) {
    return (
      <div className="container">
        <div className="alert error">{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container">
        <div>Aucune donnée</div>
      </div>
    );
  }

  const { stats, occupancyRate, trends, recentAdmins, recentLandlords, recentTickets } =
    data;
  const trendMax = maxTrendValue(trends.last7Days);

  return (
    <div className="dashboard-page container">
      <h1>Tableau de bord Admin</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Admins</h3>
          <div className="value">{stats.totalAdmins}</div>
        </div>
        <div className="stat-card">
          <h3>Total Bailleurs</h3>
          <div className="value">{stats.totalLandlords}</div>
        </div>
        <div className="stat-card">
          <h3>Total Locataires</h3>
          <div className="value">{stats.totalTenants}</div>
        </div>
        <div className="stat-card">
          <h3>Total Logements</h3>
          <div className="value">{stats.totalHousings}</div>
        </div>
        <div className="stat-card">
          <h3>Taux d&apos;occupation</h3>
          <div className="value">{occupancyRate}%</div>
        </div>
        <div className="stat-card">
          <h3>Logements Occupés</h3>
          <div className="value">{stats.occupiedHousings}</div>
        </div>
        <div className="stat-card">
          <h3>Logements Vacants</h3>
          <div className="value">{stats.vacantHousings}</div>
        </div>
        <div className="stat-card">
          <h3>Tickets Ouverts</h3>
          <div className="value">{stats.ticketsOpen}</div>
        </div>
        <div className="stat-card">
          <h3>Tickets Résolus</h3>
          <div className="value">{stats.ticketsResolved}</div>
        </div>
      </div>

      <section className="chart-section">
        <h2>Tendances (7 derniers jours)</h2>
        <p style={{ color: '#666', fontSize: 14, marginTop: 0 }}>
          Nouveaux tickets et nouveaux comptes créés par jour (UTC minuit).
        </p>
        <div className="trend-chart">
          {trends.last7Days.map((day) => (
            <div key={day.date} className="trend-day">
              <div className="trend-label">{day.date.slice(5)}</div>
              <div className="trend-bars">
                <div
                  className="trend-bar tickets"
                  style={{
                    height: `${(day.newTickets / trendMax) * 100}%`,
                  }}
                  title={`Tickets: ${day.newTickets}`}
                />
                <div
                  className="trend-bar users"
                  style={{
                    height: `${(day.newUsers / trendMax) * 100}%`,
                  }}
                  title={`Utilisateurs: ${day.newUsers}`}
                />
              </div>
              <div className="trend-counts">
                <span>T {day.newTickets}</span>
                <span>U {day.newUsers}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="trend-legend">
          <span>
            <i className="dot tickets" /> Tickets
          </span>
          <span>
            <i className="dot users" /> Nouveaux utilisateurs
          </span>
        </div>
      </section>

      <div className="recent-section">
        <h2>Récents Admins</h2>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Créé le</th>
            </tr>
          </thead>
          <tbody>
            {recentAdmins.map((admin) => (
              <tr key={admin.id}>
                <td>{admin.email ?? '—'}</td>
                <td>{admin.phone}</td>
                <td>{new Date(admin.createdAt).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="recent-section">
        <h2>Récents Bailleurs</h2>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Créé le</th>
            </tr>
          </thead>
          <tbody>
            {recentLandlords.map((landlord) => (
              <tr key={landlord.id}>
                <td>{landlord.landlord?.name || 'N/A'}</td>
                <td>{landlord.email ?? '—'}</td>
                <td>{landlord.phone}</td>
                <td>{new Date(landlord.createdAt).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="recent-section">
        <h2>Derniers tickets</h2>
        <table>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Statut</th>
              <th>Logement</th>
              <th>Créé le</th>
            </tr>
          </thead>
          <tbody>
            {(recentTickets ?? []).map((t: any) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>{t.status}</td>
                <td>{t.housing?.address ?? '—'}</td>
                <td>{new Date(t.createdAt).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardPage;
