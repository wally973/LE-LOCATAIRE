/**
 * LIVING_BUILDING_STATE — table de vérité unique (Supabase).
 * Locataire, technicien et bailleur lisent le même objet en temps réel.
 */
import type { CompanionLanguage } from '../conversation/lia-companion.types';

export type LivingSeverityZone = 'DAWN' | 'ZENITH_DANGER' | 'MIDDAY_CLARITY' | 'TWILIGHT';

export type LivingReadiness =
  | 'OPENING'
  | 'SAFETY_LOCK'
  | 'DELIBERATING'
  | 'READY_FOR_TECHNICIAN'
  | 'CLOSED';

/** Tri triple flux Archiviste — 87-712 / 87-713 / 1719. */
export type LivingCharge =
  | 'LOCATIF'
  | 'RECUPERABLE'
  | 'PATRIMOINE'
  | 'INDETERMINE';

/** Vision 3D — étage, flux, climat (VISUAL_LOGIC). */
export interface LivingVision3D {
  floorLevel: string | null;
  rooms: string[];
  element: string | null;
  symptomAnchor: string | null;
  above: string | null;
  below: string | null;
  climate: 'tropical_humid' | 'dry_season' | null;
  activeFlows: string[];
  mentalModels: string[];
  hypotheses: Array<{
    id: string;
    label: string;
    visualization: string;
    active: boolean;
    confidence: number;
  }>;
}

/** Barrière humaine — Marie et contraintes relationnelles. */
/** Perception sociale — devoir de protection (sénior, PSH…). */
export interface LivingTenantProfile {
  isVulnerable: boolean;
  reason: string;
}

/** Conscience professionnelle — interne console vs externe chat. */
export interface LivingConsciousnessState {
  socialProtectionOverride: boolean;
  socialProtectionNote: string | null;
  constructiveDoubt: boolean;
  competingModels: string[];
  internalNote: string | null;
  expertHandoffRequired: boolean;
  expertHandoffReason: string | null;
}

export interface LivingHumanBarrier {
  displayName: string;
  ageBand: 'senior' | 'adult' | 'young' | 'unknown';
  livesAlone: boolean;
  preferredLanguage: CompanionLanguage;
  creolePreferred: boolean;
  vulnerabilityNotes: string | null;
  relationalTone: string | null;
  /** Faits extraits — jamais redemander. */
  extractedFacts: Record<string, string>;
}

/** Verrou de sécurité — seule loi dure du produit. */
export interface LivingSafetyLock {
  severityZone: LivingSeverityZone;
  hazardType: 'electrical' | 'water' | 'gas' | 'structural' | 'none';
  requiresPowerCutoff: boolean;
  requiresWaterShutoff: boolean;
  safetyVerified: boolean;
  consigneGiven: boolean;
  verifiedAt: string | null;
}

/** Verdict légal — Art. 1719 / décret 87-712. */
export interface LivingLegalArticle {
  code: '1719' | '87-712' | '87-713' | 'DECRET_87-712' | 'AUTRE';
  label: string;
  applies: boolean;
  rationale: string;
}

export interface LivingLegalFact {
  id: string;
  subject: string;
  charge: LivingCharge;
  rationale: string;
}

export interface LivingLegalVerdict {
  /** Tri triple flux (LOCATIF / RÉCUPÉRABLE / PATRIMOINE). */
  chargeHorizon: LivingCharge;
  articles: LivingLegalArticle[];
  facts: LivingLegalFact[];
  summary: string | null;
  /** Conseil naturel pour Marie (ex. charges récupérables 87-713). */
  tenantChargeExplanation: string | null;
  /** Cas AFPOLS / terrain mobilisé (trace interne). */
  afpolGrounding: string | null;
}

/** Logique d'intervention — technicien temps réel. */
export interface LivingInterventionLogic {
  tradeNeeded: string | null;
  partsToBring: string[];
  toolsRequired: string[];
  urgencyLabel: string;
  technicianSummary: string | null;
  readyForDispatch: boolean;
}

export interface LivingDeliberationEcho {
  agent: 'majordome' | 'enqueteur' | 'archiviste';
  model: string;
  insight: string;
  at: string;
}

/** Étanchéité — un ticket = un métier (post-transmission). */
export interface LivingDossierIntegrity {
  sealed: boolean;
  sealedAt: string | null;
  primaryTrade: string | null;
  signalementScope: string | null;
  oneTicketOneTrade: boolean;
}

/** Carte rôle — symbiose équipe experts (console Lia-Lab). */
export interface LivingTeamAgentCard {
  role: string;
  label: string;
  mission: string;
  lastInsight: string;
}

export interface LivingTeamSymbiosis {
  charter: string;
  agents: LivingTeamAgentCard[];
  updatedAt: string;
}

/** Instruments de Bord — consultés par le Majordome avant parole. */
export interface LivingInstrumentsBoard {
  updatedAt: string;
  enqueteurInsight: string | null;
  archivisteInsight: string | null;
  majordomeFactsInsight: string | null;
  activeFlows: string[];
  mentalModels: string[];
  chargeHorizon: string;
  tradeNeeded: string | null;
  socialProtection: string | null;
  constructiveDoubt: string | null;
  savoirCount: number;
  pilotBrief: string;
}

/** Rapports d'expertise libres (JSON carnet de bord — Niveau 6). */
export interface LivingExpertReports {
  enqueteur: Record<string, unknown> | null;
  archiviste: Record<string, unknown> | null;
  majordomeFacts: Record<string, unknown> | null;
}

/** Intelligence Symétrique — métadonnées délibération. */
export interface LivingSymmetricDeliberation {
  level: 6;
  interlocutorFace: 'locataire' | 'technicien' | 'bailleur' | 'equipe_test';
  instrumentsBoard: LivingInstrumentsBoard;
  expertReports: LivingExpertReports;
  contradictionActive: boolean;
  contradictionNote: string | null;
  doctrineVersion: string;
}

/** Source ouverte par un agent (@knowledge / legal-references) — traçabilité Lia-Lab. */
export type LivingSavoirCorpus = 'AFPOLS' | 'AQC' | 'DECRET' | 'LOI';

export interface LivingSavoirConsultation {
  agent: 'enqueteur' | 'archiviste';
  corpus: LivingSavoirCorpus;
  ref: string;
  title: string;
  url?: string;
  /** Libellé console Lia-Lab */
  label: string;
  hypothesisId?: string;
  hypothesisLabel?: string;
  relevance: number;
  consultedAt: string;
}

export interface LivingBuildingState {
  schema: 'LIVING_BUILDING_STATE';
  version: 3 | 6;
  updatedAt: string;
  language: CompanionLanguage;
  readiness: LivingReadiness;
  signalementTitle: string;
  signalementDescription: string;
  tenantProfile: LivingTenantProfile;
  consciousness: LivingConsciousnessState;
  vision3d: LivingVision3D;
  humanBarrier: LivingHumanBarrier;
  safetyLock: LivingSafetyLock;
  legalVerdict: LivingLegalVerdict;
  intervention: LivingInterventionLogic;
  deliberationRound: number;
  deliberationEchoes: LivingDeliberationEcho[];
  /** Pages AFPOL/AQC/Décrets consultées ce tour — éducation par les documents */
  savoirConsulted: LivingSavoirConsultation[];
  /** Scellement post-handoff — nouveau sujet → nouvelle demande */
  dossierIntegrity: LivingDossierIntegrity;
  /** Équipe Enquêteur · Archiviste · Majordome — dernier tour */
  teamSymbiosis: LivingTeamSymbiosis;
  /** Niveau 6 — délibération symétrique */
  symmetricDeliberation: LivingSymmetricDeliberation;
  /** Gardien N7 — dernier verdict souverain */
  guardianReview?: LivingGuardianReview | null;
  /** Leçons Stylo en attente signature Architecte */
  doctrinePending?: LivingPendingDoctrineLesson[];
  lastTenantMessage: string | null;
  reasoningSource: 'living_intelligence';
}

export interface LivingDeliberationTurnResult {
  livingState: LivingBuildingState;
  tenantMessage: string;
  intakeComplete: boolean;
  handoffRequired: boolean;
  handoffReason: string | null;
  /** Leçons doctrine interceptées par le Gardien (Stylo). */
  pendingDoctrineLessons?: LivingPendingDoctrineLesson[];
}

/** Mission sacrée du Gardien (Phase B N7). */
export type LivingGuardianMission = 'COHERENCE' | 'SAFETY' | 'SOCIAL' | 'DOCTRINE';

export type LivingGuardianVerdictKind = 'PASS' | 'RE-DELIBERATE' | 'OVERRIDE';

export interface LivingPendingDoctrineLesson {
  id: string;
  author: string;
  title: string;
  status: 'PENDING_ADMIN_SIGNATURE' | 'SIGNED';
  filePath: string;
}

/** Verdict souverain post-délibération — visible Lia-Lab. */
export interface LivingGuardianReview {
  verdict: LivingGuardianVerdictKind;
  murmures: string[];
  missionsTriggered: LivingGuardianMission[];
  reviewedAt: string;
  originalParole: string;
  finalParole: string;
  redeliberationBrief?: string | null;
  pendingDoctrineLessons?: LivingPendingDoctrineLesson[];
}
