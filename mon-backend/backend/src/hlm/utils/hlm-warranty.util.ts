import type {
  HlmTicketRoutingTarget,
  WarrantyPhase,
} from '@prisma/client';

export interface WarrantyWindow {
  gpaEnd: Date;
  biennaleEnd: Date;
  decennaleEnd: Date;
}

/** Dates garanties : GPA +1 an, biennale +2 ans, décennale +10 ans (calendaires). */
export function computeWarrantyWindow(deliveryDate: Date): WarrantyWindow {
  const gpaEnd = addYears(deliveryDate, 1);
  const biennaleEnd = addYears(deliveryDate, 2);
  const decennaleEnd = addYears(deliveryDate, 10);
  return { gpaEnd, biennaleEnd, decennaleEnd };
}

export function addYears(d: Date, years: number): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + years);
  return x;
}

/** Phase garantie à une date d’incident donnée (jour courant par défaut). */
export function resolveWarrantyPhaseAtDate(
  deliveryDate: Date,
  incidentDate: Date = new Date(),
): WarrantyPhase {
  const { gpaEnd, biennaleEnd, decennaleEnd } =
    computeWarrantyWindow(deliveryDate);
  const t = stripTime(incidentDate);
  if (t < stripTime(gpaEnd)) return 'GPA_ACTIVE';
  if (t < stripTime(biennaleEnd)) return 'BIENNALE_ACTIVE';
  if (t < stripTime(decennaleEnd)) return 'DECENNALE_ACTIVE';
  return 'HORS_GARANTIE';
}

function stripTime(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Routage automatique selon phase garantie et présence service GPA sur résidence / bailleur. */
export function computeRoutingTarget(params: {
  phase: WarrantyPhase;
  residenceHasInternalGpa: boolean;
  bailleurHasInternalGpa: boolean;
}): HlmTicketRoutingTarget {
  const { phase, residenceHasInternalGpa, bailleurHasInternalGpa } = params;
  if (phase === 'GPA_ACTIVE') {
    if (residenceHasInternalGpa || bailleurHasInternalGpa) {
      return 'SERVICE_TECHNIQUE_INTERNE';
    }
    return 'BAILLEUR';
  }
  if (phase === 'BIENNALE_ACTIVE') return 'BIENNALE';
  if (phase === 'DECENNALE_ACTIVE') return 'DECENNALE';
  /// Hors garantie : premier niveau bailleur / gestionnaire patrimoine
  return 'BAILLEUR';
}
