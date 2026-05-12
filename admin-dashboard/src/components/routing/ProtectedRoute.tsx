import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import authService from '@services/authService';
import type { UserRole } from '@auth/roles';
import { defaultRouteForRole } from '@auth/roles';

interface Props {
  /** Si défini, seuls ces rôles accèdent à la suite des routes */
  roles?: UserRole[];
}

/**
 * Garde d’authentification + optionnellement restriction par rôle (JWT).
 */
const ProtectedRoute: React.FC<Props> = ({ roles }) => {
  const location = useLocation();

  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const current = authService.getRole();
  if (roles?.length && (!current || !roles.includes(current))) {
    const fallback = current ? defaultRouteForRole(current) : '/login';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
