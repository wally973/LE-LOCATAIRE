import type { GrockChatMessage } from '../grock.service';

/**
 * PACK MÉTIER — Couche 3 de l'architecture Grock.
 *
 * Tout le savoir spécifique à l'application (pathologies bâtiment, opérations
 * logement social, doctrine de déduction, responsabilité) est fourni AU noyau
 * via cette porte. Le noyau (les 5 têtes) n'importe plus aucun savoir métier :
 * pour une autre application, on remplace le pack, le noyau ne bouge pas.
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
}
