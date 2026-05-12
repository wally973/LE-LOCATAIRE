/** Clés publiques métier (UUID) — ne pas confondre avec identifiants legacy Int du reste de l’ERP. */
export type PublicUuid = string;

export interface WarrantyDatesDto {
  deliveryDateIso: string;
  gpaEndDateIso: string;
  biennaleEndDateIso: string;
  decennaleEndDateIso: string;
}

export interface HlmResidenceDto {
  reference: PublicUuid;
  name: string;
  bailleurReference: PublicUuid;
  constructionYear?: number;
  deliveryDateIso: string;
  residenceNeuve: boolean;
  hasInternalGPAServicePerResidence: boolean;
  warranty: WarrantyDatesDto;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface HlmLogementDto {
  reference: PublicUuid;
  label: string;
  externalRef?: string | null;
  residenceReference: PublicUuid;
  hasVmc: boolean;
  hasSolarWaterHeater: boolean;
  hasCour: boolean;
  hasJardin: boolean;
  hasTerrasse: boolean;
  hasPatio: boolean;
  locataireReference?: PublicUuid | null;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface HlmEntretienTypeDto {
  reference: PublicUuid;
  code: string;
  labelFr: string;
  description?: string | null;
  frequency: string;
  requiresOutdoorContext: boolean;
}

export interface HlmLogementEntretienDto {
  reference: PublicUuid;
  logementReference: PublicUuid;
  entretienTypeReference: PublicUuid;
  code: string;
  active: boolean;
  nextDueAtIso?: string | null;
  lastCompletedAtIso?: string | null;
}

export interface HlmEntretienPreuveDto {
  reference: PublicUuid;
  logementEntretienReference: PublicUuid;
  locataireReference?: PublicUuid | null;
  checklist: Record<string, unknown>;
  photoAccessPrimary: string;
  photoAccessSecondary: string;
  validatedByAi: boolean;
  validatedByLandlord: boolean;
  statut: string;
  landlordValidatedAtIso?: string | null;
  aiValidatedAtIso?: string | null;
  createdAtIso: string;
}

export interface HlmTicketDto {
  reference: PublicUuid;
  title: string;
  description?: string | null;
  category: string;
  urgency: string;
  status: string;
  warrantyPhase?: string | null;
  routingTarget: string;
  routingNotes?: string | null;
  maintenanceBlocked: boolean;
  blockedReason?: string | null;
  logementReference: PublicUuid;
  locataireReference?: PublicUuid | null;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface HlmIAResultDto {
  reference: PublicUuid;
  kind: string;
  imageAnalysis?: Record<string, unknown> | null;
  diagnostic?: Record<string, unknown> | null;
  routingSuggestion?: Record<string, unknown> | null;
  confidence?: number | null;
  ticketReference?: PublicUuid | null;
  proofReference?: PublicUuid | null;
  modelVersion?: string | null;
  createdAtIso: string;
}
