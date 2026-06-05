export * from './lia-diagnostic-state.types';
export * from './lia-diagnostic-state';
export * from './lia-diagnostic-sensors';
export * from './lia-case-context';
export * from './savoir-voir.types';
export {
  DiagnosticContextService,
  type TicketDiagnosticContext,
} from './diagnostic-context.service';
export {
  LIA_JARVIS_POST_IDENTITY,
  formatTenantSocialLandscapeBlock,
  type LiaTenantSocialContext,
  type LiaTenantAgeBand,
  type LiaInterlocutorRole,
} from './lia-jarvis-identity';
export {
  loadTenantSocialContext,
  buildLabTenantSocialContext,
} from './lia-tenant-social-context';
export { AgentsSharedModule } from './agents-shared.module';
export {
  resolveAiCategoryFromContext,
  resolveSeverityFromContext,
  classifySocialRiskFromText,
  buildDiagnosticBrief,
  type SocialRiskAssessment,
  type TicketSeverity,
} from './diagnostic-ticket-insights';
export {
  isSavonneuseR1RefoulementSensors,
  INSURANCE_REFOULEMENT_EU_NOTE,
  LEGAL_REFOULEMENT_EU_SUMMARY,
  LEGAL_REFOULEMENT_EU_SLUGS,
} from './refoulement-eu-context';
