import React from 'react';
import { Navigate } from 'react-router-dom';
import authService from '@services/authService';
import { defaultRouteForRole } from '@auth/roles';

/** Redirection `/` selon le rôle stocké après login */
const RootRedirect: React.FC = () => {
  const role = authService.getRole();
  return <Navigate to={defaultRouteForRole(role)} replace />;
};

export default RootRedirect;
