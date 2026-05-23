/** Actions de qualification configurables par bailleur (Q63). */
export const QUALIFICATION_FLAG_KEYS = [
  'liaConversationEnabled',
  'requirePhotoEvidence',
  'liaAutoResearchEnabled',
  'technicianCreateTicketEnabled',
  'liaTicketRelanceEnabled',
] as const;

export type QualificationFlagKey = (typeof QUALIFICATION_FLAG_KEYS)[number];

export type QualificationFlags = Record<QualificationFlagKey, boolean>;

export const DEFAULT_QUALIFICATION_FLAGS: QualificationFlags = {
  liaConversationEnabled: true,
  requirePhotoEvidence: true,
  liaAutoResearchEnabled: true,
  technicianCreateTicketEnabled: false,
  liaTicketRelanceEnabled: false,
};
