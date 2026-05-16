import { NonRecevableReason, TicketResponsibility } from '@prisma/client';

/**
 * Contexte fourni au pipeline IA pour qu'il prenne une décision.
 * On lui passe uniquement ce qui est strictement nécessaire (pas de PII).
 */
export interface AiPipelineInput {
  /** Description libre saisie par le locataire (peut contenir des contraintes). */
  description: string;
  /** Titre court du ticket. */
  title: string;
  /** Tentative en cours (1 = première analyse, 2 = après re-photo, etc.). */
  attempt: number;
  /** URLs des photos déjà fournies (peut être vide). */
  photoUrls: string[];
  /** Indications locataire si re-feedback : "j'ai répondu à la question / je précise". */
  tenantFeedback?: string;
  /** Locale du locataire (fr-FR par défaut). */
  locale: string;
  /** Bailleur du logement — alimente le RAG juriste (Sprint G). */
  landlordProfileId?: number;
  /** Logement concerné — mémoires spécifiques résidence (Sprint G). */
  housingId?: number;
}

/**
 * Décision normalisée produite par le pipeline IA.
 */
export interface AiPipelineDecision {
  /** Décision principale du routage. */
  responsibility: TicketResponsibility;
  /** Catégorie technique (PLUMBING, ELECTRICITY, HUMIDITY, ...). */
  category: string;
  /** Sévérité textuelle (LOW / MEDIUM / HIGH). */
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Score de confiance dans [0,1]. */
  confidence: number;
  /** True si l'IA veut demander une autre photo (cas blur / insuffisant). */
  needsMorePhoto: boolean;
  /** Message en clair à renvoyer au locataire (déjà localisé côté pipeline). */
  message: string;
  /** Suggestion d'artisan si responsibility = LOCATAIRE (PLUMBER, ELEC, etc.). */
  suggestedArtisanType?: string;
  /** Raison de NON_RECEVABLE si applicable. */
  nonRecevableReason?: NonRecevableReason;
  /** True si l'IA détecte un signal social (impayé loyer, etc.) → ouvre SocialCase. */
  socialFlag: boolean;
  /** Trace JSON des étapes pour debug + AiDiagnostic (sans PII). */
  pipelineSteps: Array<{
    name: string;
    decision: string;
    confidence?: number;
    extra?: Record<string, unknown>;
  }>;
}

/**
 * Port (au sens hexagonal) : le tickets/ et le ai-routing/ ne dépendent que de
 * cette interface, jamais d'un fournisseur LLM concret.
 * Sprint 3 fournit un adapter stub déterministe ; Sprint 7+ branchera un LLM.
 */
export interface AiPipelinePort {
  analyze(input: AiPipelineInput): Promise<AiPipelineDecision>;
}

/** Token Nest pour l'injection du port. */
export const AI_PIPELINE = Symbol('AI_PIPELINE');
