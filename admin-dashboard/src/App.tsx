import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import LandlordLayout from '@layouts/LandlordLayout';
import TenantLayout from '@layouts/TenantLayout';
import ProtectedRoute from '@components/routing/ProtectedRoute';
import RootRedirect from '@components/routing/RootRedirect';
import LoginPage from '@pages/LoginPage';
import DashboardPage from '@pages/DashboardPage';
import AdminsPage from '@pages/AdminsPage';
import LandlordsPage from '@pages/LandlordsPage';
import LandlordDetailsPage from '@pages/LandlordDetailsPage';
import StatsPage from '@pages/StatsPage';
import AuditLogPage from '@pages/AuditLogPage';
import AdminSettingsPage from '@pages/AdminSettingsPage';
import HousingsPage from '@pages/HousingsPage';
import AdminUsersPage from '@pages/admin/AdminUsersPage';
import AdminTenantsPage from '@pages/admin/AdminTenantsPage';
import AdminTicketsPage from '@pages/admin/AdminTicketsPage';
import AdminPaymentsPage from '@pages/admin/AdminPaymentsPage';
import AdminTicketDetailPage from '@pages/admin/AdminTicketDetailPage';
import AdminAvatarsPage from '@pages/admin/AdminAvatarsPage';
import AdminIaStatsPage from '@pages/admin/AdminIaStatsPage';
import LiaLabPage from '@pages/admin/LiaLabPage';
import LandlordDashboardPage from '@pages/bailleur/LandlordDashboardPage';
import LandlordHousingsPage from '@pages/bailleur/LandlordHousingsPage';
import LandlordHousingDetailPage from '@pages/bailleur/LandlordHousingDetailPage';
import LandlordTenantsPage from '@pages/bailleur/LandlordTenantsPage';
import LandlordTenantDetailPage from '@pages/bailleur/LandlordTenantDetailPage';
import LandlordPaymentsPage from '@pages/bailleur/LandlordPaymentsPage';
import LandlordTicketsPage from '@pages/bailleur/LandlordTicketsPage';
import LandlordTicketDetailPage from '@pages/bailleur/LandlordTicketDetailPage';
import LandlordProfilePage from '@pages/bailleur/LandlordProfilePage';
import LandlordCaseSearchPage from '@pages/bailleur/LandlordCaseSearchPage';
import AgentLayout from '@layouts/AgentLayout';
import AgentReclamationsPage from '@pages/agent/AgentReclamationsPage';
import LocataireDashboardPage from '@pages/locataire/LocataireDashboardPage';
import LocatairePaymentsPage from '@pages/locataire/LocatairePaymentsPage';
import LocatairePaymentDetailPage from '@pages/locataire/LocatairePaymentDetailPage';
import LocataireReceiptsPage from '@pages/locataire/LocataireReceiptsPage';
import LocataireTicketsPage from '@pages/locataire/LocataireTicketsPage';
import LocataireTicketDetailPage from '@pages/locataire/LocataireTicketDetailPage';
import LocataireProfilePage from '@pages/locataire/LocataireProfilePage';
import LocataireSettingsPage from '@pages/locataire/LocataireSettingsPage';
import { loadAdminPrefs } from '@hooks/adminPrefs';
import './App.css';

function App() {
  useEffect(() => {
    const p = loadAdminPrefs();
    document.body.classList.toggle('theme-dark', p.theme === 'dark');
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<RootRedirect />} />
        </Route>

        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="admins" element={<AdminsPage />} />
            <Route path="landlords" element={<LandlordsPage />} />
            <Route path="landlords/:id" element={<LandlordDetailsPage />} />
            <Route path="housings" element={<HousingsPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="tenants" element={<AdminTenantsPage />} />
            <Route path="tickets" element={<AdminTicketsPage />} />
            <Route path="tickets/:id" element={<AdminTicketDetailPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="avatars" element={<AdminAvatarsPage />} />
            <Route path="ia-stats" element={<AdminIaStatsPage />} />
            <Route path="lia-lab" element={<LiaLabPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['AGENT']} />}>
          <Route path="/agent" element={<AgentLayout />}>
            <Route index element={<Navigate to="reclamations" replace />} />
            <Route path="reclamations" element={<AgentReclamationsPage />} />
            <Route
              path="tickets/:id"
              element={<LandlordTicketDetailPage />}
            />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['LANDLORD']} />}>
          <Route path="/bailleur" element={<LandlordLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<LandlordDashboardPage />} />
            <Route path="logements" element={<LandlordHousingsPage />} />
            <Route path="logements/:id" element={<LandlordHousingDetailPage />} />
            <Route path="locataires" element={<LandlordTenantsPage />} />
            <Route path="locataires/:id" element={<LandlordTenantDetailPage />} />
            <Route path="paiements" element={<LandlordPaymentsPage />} />
            <Route path="recherche" element={<LandlordCaseSearchPage />} />
            <Route path="tickets" element={<LandlordTicketsPage />} />
            <Route path="tickets/:id" element={<LandlordTicketDetailPage />} />
            <Route path="profil" element={<LandlordProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['TENANT']} />}>
          <Route path="/locataire" element={<TenantLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<LocataireDashboardPage />} />
            <Route path="paiements" element={<LocatairePaymentsPage />} />
            <Route path="paiements/:id" element={<LocatairePaymentDetailPage />} />
            <Route path="quittances" element={<LocataireReceiptsPage />} />
            <Route path="tickets" element={<LocataireTicketsPage />} />
            <Route path="tickets/:id" element={<LocataireTicketDetailPage />} />
            <Route path="profil" element={<LocataireProfilePage />} />
            <Route path="parametres" element={<LocataireSettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
