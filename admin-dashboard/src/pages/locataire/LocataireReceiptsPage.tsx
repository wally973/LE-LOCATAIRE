import { Navigate } from 'react-router-dom';

/** Redirection : les quittances sont listées sous Paiements. */
const LocataireReceiptsPage: React.FC = () => (
  <Navigate to="/locataire/paiements" replace />
);

export default LocataireReceiptsPage;
