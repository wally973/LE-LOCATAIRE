import type { GrockHeadInputs } from '../head-input/head-input.types';
import type { GrockInterlocutor } from '../kernel/grock-interlocutor';

/** Entrée — garde-fous parole post-parse (Tête 5, métier). */
export interface ParoleSupplementInput {
  acknowledgment: string;
  headInputs: GrockHeadInputs;
  interlocutor: GrockInterlocutor;
  state?: string | null;
}

/** Port parole — le noyau ne connaît pas les supplements métier. */
export type ParoleSupplementPort = {
  applyParoleSupplements(input: ParoleSupplementInput): string;
};
