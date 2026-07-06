import type { ParoleSupplementInput } from './parole-supplement.port';

/** Pack neutre — aucun supplement de parole. */
export function applyParoleSupplementsEmpty(input: ParoleSupplementInput): string {
  return input.acknowledgment;
}
