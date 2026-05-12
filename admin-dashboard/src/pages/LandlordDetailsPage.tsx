import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminApi, { Landlord } from '@services/adminApi';

const LandlordDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLandlord = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const data = await adminApi.getLandlordById(parseInt(id, 10));
      setLandlord(data);
    } catch {
      setError('Erreur lors du chargement du bailleur');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLandlord();
  }, [fetchLandlord]);

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="alert error">{error}</div>;
  if (!landlord) return <div>Bailleur non trouvé</div>;

  const housings = landlord.landlord?.housings || [];

  return (
    <div>
      <button className="secondary" onClick={() => navigate('/admin/landlords')} style={{ marginBottom: '20px' }}>
        ← Retour
      </button>

      <div className="card">
        <h1>{landlord.landlord?.name}</h1>
        <table>
          <tbody>
            <tr>
              <td>Email:</td>
              <td>{landlord.email ?? '—'}</td>
            </tr>
            <tr>
              <td>Téléphone:</td>
              <td>{landlord.phone}</td>
            </tr>
            <tr>
              <td>Créé le:</td>
              <td>{new Date(landlord.createdAt).toLocaleDateString('fr-FR')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Logements ({housings.length})</h2>
        {housings.length === 0 ? (
          <p>Aucun logement</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Adresse</th>
                <th>Ville</th>
                <th>Code Postal</th>
                <th>Validé</th>
                <th>Locataire</th>
              </tr>
            </thead>
            <tbody>
              {housings.map((housing) => (
                <tr key={housing.id}>
                  <td>{housing.address}</td>
                  <td>{housing.city}</td>
                  <td>{housing.postalCode}</td>
                  <td>{housing.isValidated ? 'Oui' : 'Non'}</td>
                  <td>
                    {housing.currentTenant
                      ? `${housing.currentTenant.firstName} ${housing.currentTenant.lastName}`
                      : 'Vacant'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LandlordDetailsPage;
