import type { GrockChatMessage } from '../grock.service';
import type { GrockHeadInputs } from '../head-input/head-input.types';
import type { HeadInputsJournalSnapshot } from './head-pack.contract';
import type {
  Head3PackOutput,
  Head4PackOutput,
  Head5PackOutput,
  HeadEnrichmentContext,
} from './head-enrichment.types';
import type { ParoleSupplementInput } from './parole-supplement.port';

/**
 * PACK MÉTIER — Couche 3 de l'architecture Grock.
 *
 * Tout le savoir spécifique à l'application (pathologies bâtiment, opérations
 * logement social, doctrine de déduction, responsabilité) est fourni AU noyau
 * via cette porte. Le noyau (les 5 têtes) n'importe plus aucun savoir métier :
 * pour une autre application, on remplace le pack, le noyau ne bouge pas.
 *
 * Phase 1 : enrichissement T3–T5 par le pack (scores, états, thèmes parole).
 * Phase 5 : supplements parole via applyParoleSupplements.
 */

/** Jeton d'injection NestJS du pack métier (voir grock.module). */
export const DOMAIN_PACK = Symbol('GROCK_DOMAIN_PACK');

/** Contexte transmis par le noyau au pack pour cibler le savoir utile. */
export interface GrockDomainContext {
  title: string;
  description: string;
  tenantMessage?: string;
  sessionMessages?: GrockChatMessage[];
  visualPerception?: string | null;
}

/**
 * Blocs de savoir métier à injecter dans le prompt intercom.
 * - `head` : avant le signalement (domaine, doctrine, opérations).
 * - `tail` : après le signalement (documentation pathologies).
 */
export interface GrockDomainKnowledge {
  head: string[];
  tail: string[];
}

export interface GrockDomainPack {
  /** Nom lisible du pack branché (logs / diagnostic). */
  readonly label: string;

  /** Savoir métier pour un tour de dialogue intercom (têtes 3 & 4). */
  intercomKnowledge(context: GrockDomainContext): GrockDomainKnowledge;

  /** Savoir métier pour la consultation pathologie experte (hors intercom). */
  pathologyKnowledge(): string;

  /** Tête 3 — hypothèses pondérées (métier). */
  enrichHead3(ctx: HeadEnrichmentContext): Head3PackOutput;

  /** Tête 4 — états candidats, doctrine, IRSI/recours (métier). */
  enrichHead4(ctx: HeadEnrichmentContext, head3: Head3PackOutput): Head4PackOutput;

  /** Tête 5 — thèmes de parole attendus (métier). */
  enrichHead5(
    ctx: HeadEnrichmentContext,
    head3: Head3PackOutput,
    head4: Head4PackOutput,
  ): Head5PackOutput;

  /** Snapshot journal T3–T5 (métier). */
  serializeHeadInputsJournal(inputs: GrockHeadInputs): HeadInputsJournalSnapshot;

  /** Garde-fous parole locataire (Tête 5 — métier, pas de script). */
  applyParoleSupplements(input: ParoleSupplementInput): string;
}
