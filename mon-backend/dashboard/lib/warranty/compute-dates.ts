import type { Residence, ResidenceWarrantySchedule } from "@/types";

function addMonths(isoDelivery: string, months: number): string {
  const d = new Date(isoDelivery);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Règle métier : GPA +1 an, biennale +2 ans depuis date livraison, décennale +10 ans calendaires simplifiées en années. */
export function computeWarrantyDates(
  residence: Pick<Residence, "deliveryDate">,
): Omit<ResidenceWarrantySchedule, "residenceId"> {
  const delivery = residence.deliveryDate;
  const d = new Date(delivery);

  const gpa = new Date(d);
  gpa.setFullYear(gpa.getFullYear() + 1);

  const biennale = new Date(d);
  biennale.setFullYear(biennale.getFullYear() + 2);

  const decennale = new Date(d);
  decennale.setFullYear(decennale.getFullYear() + 10);

  return {
    deliveryDate: delivery.slice(0, 10),
    gpaEndDate: gpa.toISOString().slice(0, 10),
    biennaleEndDate: biennale.toISOString().slice(0, 10),
    decennaleEndDate: decennale.toISOString().slice(0, 10),
  };
}

/** Variante mensuelle utilisée uniquement pour ajustements d’UX si vous préférez “+12 mois” exacts au jour */
export function computeWarrantyDatesByMonth(deliveryIso: string) {
  return {
    gpaEndDate: addMonths(deliveryIso, 12),
    biennaleEndDate: addMonths(deliveryIso, 24),
    decennaleEndDate: addMonths(deliveryIso, 120),
  };
}
