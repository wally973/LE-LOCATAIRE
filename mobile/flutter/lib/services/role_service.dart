enum UserRole {
  admin,
  bailleur,
  tenant,
  unknown,
}

UserRole parseUserRole(String role) {
  switch (role.toUpperCase()) {
    case 'ADMIN':
      return UserRole.admin;
    case 'BAILLEUR':
      return UserRole.bailleur;
    case 'TENANT':
      return UserRole.tenant;
    default:
      return UserRole.unknown;
  }
}

String roleToString(UserRole role) {
  switch (role) {
    case UserRole.admin:
      return 'ADMIN';
    case UserRole.bailleur:
      return 'BAILLEUR';
    case UserRole.tenant:
      return 'TENANT';
    default:
      return 'UNKNOWN';
  }
}
