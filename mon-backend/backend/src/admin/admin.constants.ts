/** Types d’entités pour le journal d’audit */
export const AUDIT_ENTITY = {
  USER: 'USER',
  HOUSING: 'HOUSING',
} as const;

/** Actions enregistrées dans AdminAuditLog */
export const AUDIT_ACTION = {
  CREATE_ADMIN: 'CREATE_ADMIN',
  UPDATE_ADMIN: 'UPDATE_ADMIN',
  DELETE_ADMIN: 'DELETE_ADMIN',
  CREATE_LANDLORD: 'CREATE_LANDLORD',
  UPDATE_LANDLORD: 'UPDATE_LANDLORD',
  DELETE_LANDLORD: 'DELETE_LANDLORD',
  SET_USER_AVAILABILITY: 'SET_USER_AVAILABILITY',
} as const;
