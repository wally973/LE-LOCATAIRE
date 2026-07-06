import type { ParoleSupplementInput } from '../../parole-supplement.port';
import { applyHead5ParoleSupplements } from './head5-parole-supplement';

/** Supplements parole — pack logement social. */
export function applySocialHousingParoleSupplements(
  input: ParoleSupplementInput,
): string {
  return applyHead5ParoleSupplements(
    input.acknowledgment,
    input.headInputs,
    input.interlocutor,
    input.state,
  );
}
