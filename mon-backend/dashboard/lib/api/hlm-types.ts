/** Réponses JSON socle HLM (alignées sur `backend/src/hlm/dto/hlm-shared.dto.ts`). */

export interface WarrantyDatesDto {
  deliveryDateIso: string;
  gpaEndDateIso: string;
  biennaleEndDateIso: string;
  decennaleEndDateIso: string;
}

export interface HlmResidenceDto {
  reference: string;
  name: string;
  bailleurReference: string;
  constructionYear?: number;
  deliveryDateIso: string;
  residenceNeuve: boolean;
  hasInternalGPAServicePerResidence: boolean;
  warranty: WarrantyDatesDto;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface HlmLogementDto {
  reference: string;
  label: string;
  externalRef?: string | null;
  residenceReference: string;
  hasVmc: boolean;
  hasSolarWaterHeater: boolean;
  hasCour: boolean;
  hasJardin: boolean;
  hasTerrasse: boolean;
  hasPatio: boolean;
  locataireReference?: string | null;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface HlmLogementEntretienDto {
  reference: string;
  logementReference: string;
  entretienTypeReference: string;
  code: string;
  active: boolean;
  nextDueAtIso?: string | null;
  lastCompletedAtIso?: string | null;
}

export interface HlmEntretienPreuveDto {
  reference: string;
  logementEntretienReference: string;
  locataireReference?: string | null;
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
  reference: string;
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
  logementReference: string;
  locataireReference?: string | null;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface SubmitProofPayload {
  checklist: Record<string, unknown>;
  photo1Url: string;
  photo2Url: string;
  locataireId?: string | null;
}

export interface CreateHlmTicketPayload {
  title: string;
  description?: string | null;
  category: string;
  urgency?: string;
  status?: string;
  logementId: string;
  locataireId?: string | null;
  routingNotes?: string | null;
}
