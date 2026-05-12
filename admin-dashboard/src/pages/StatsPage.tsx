import React, { useEffect, useState } from 'react';
import adminApi, { Stats } from '@services/adminApi';

const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getStats();
      setStats(data);
    } catch (err: any) {
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="alert error">{error}</div>;
  if (!stats) return <div>Aucune donnée</div>;

  return (
    <div>
      <h1>Statistiques Globales</h1>

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

      <div className="card">
        <h2>Résumé</h2>
        <table>
          <tbody>
            <tr>
              <td>Taux d'occupation:</td>
              <td>
                {stats.totalHousings > 0
                  ? ((stats.occupiedHousings / stats.totalHousings) * 100).toFixed(2)
                  : 0}
                %
              </td>
            </tr>
            <tr>
              <td>Tickets résolution:</td>
              <td>
                {stats.ticketsOpen + stats.ticketsResolved > 0
                  ? ((stats.ticketsResolved / (stats.ticketsOpen + stats.ticketsResolved)) * 100).toFixed(2)
                  : 0}
                %
              </td>
            </tr>
            <tr>
              <td>Moyenne locataires par bailleur:</td>
              <td>
                {stats.totalLandlords > 0
                  ? (stats.totalTenants / stats.totalLandlords).toFixed(2)
                  : 0}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StatsPage;
