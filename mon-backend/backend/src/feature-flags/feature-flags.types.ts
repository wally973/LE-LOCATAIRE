/** Clés des modules activables par bailleur (Sprint 6A). */
export const LANDLORD_MODULE_KEYS = [
  'ticketsModule',
  'tenantOnboardingModule',
  'aiRoutingModule',
  'videoLibraryModule',
  'artisanRequestsModule',
  'socialModule',
  'hlmModule',
  'contratsModule',
  'paiementsModule',
] as const;

export type LandlordModuleKey = (typeof LANDLORD_MODULE_KEYS)[number];
