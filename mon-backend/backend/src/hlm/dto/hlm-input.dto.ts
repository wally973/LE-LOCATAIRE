import type {
  EntretienTypeCode,
  HlmIAResultKind,
  HlmTicketCategory,
  HlmTicketRoutingTarget,
  HlmTicketStatus,
  HlmTicketUrgency,
  MaintenanceFrequency,
  WarrantyPhase,
} from '@prisma/client';

/** Entrées services — références métier UUID */
export interface CreateResidenceInput {
  bailleurId: string;
  name: string;
  deliveryDate: Date;
  constructionYear?: number;
  residenceNeuve?: boolean;
  hasInternalGPAServicePerResidence?: boolean;
}

export interface UpdateResidenceInput {
  name?: string;
  deliveryDate?: Date;
  constructionYear?: number | null;
  residenceNeuve?: boolean;
  hasInternalGPAServicePerResidence?: boolean;
}

export interface CreateLogementInput {
  residenceId: string;
  label: string;
  externalRef?: string | null;
  hasVmc?: boolean;
  hasSolarWaterHeater?: boolean;
  hasCour?: boolean;
  hasJardin?: boolean;
  hasTerrasse?: boolean;
  hasPatio?: boolean;
}

export interface UpdateLogementInput {
  label?: string;
  externalRef?: string | null;
  hasVmc?: boolean;
  hasSolarWaterHeater?: boolean;
  hasCour?: boolean;
  hasJardin?: boolean;
  hasTerrasse?: boolean;
  hasPatio?: boolean;
}

export interface CreateEntretienTypeInput {
  code: EntretienTypeCode;
  labelFr: string;
  description?: string | null;
  frequency: MaintenanceFrequency;
  requiresOutdoorContext?: boolean;
}

export interface SubmitProofInput {
  checklist: Record<string, unknown>;
  photo1Url: string;
  photo2Url: string;
  locataireId?: string | null;
}

export interface CreateHlmTicketInput {
  title: string;
  description?: string | null;
  category: HlmTicketCategory;
  urgency?: HlmTicketUrgency;
  status?: HlmTicketStatus;
  logementId: string;
  locataireId?: string | null;
  routingNotes?: string | null;
}

export interface SaveIAResultInput {
  kind: HlmIAResultKind;
  imageAnalysis?: Record<string, unknown> | null;
  diagnostic?: Record<string, unknown> | null;
  routingIA?: Record<string, unknown> | null;
  confidence?: number | null;
  ticketId?: string | null;
  entretienPreuveId?: string | null;
  modelVersion?: string | null;
}

export interface ValidateProofAiInput {
  accepted: boolean;
  confidence?: number | null;
  details?: Record<string, unknown>;
}
