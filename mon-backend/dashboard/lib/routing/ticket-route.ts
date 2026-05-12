import type { Residence, TicketRoutingSuggestion } from "@/types";
import type { WarrantyPhase } from "@/types";
import { computeWarrantyDatesByMonth } from "@/lib/warranty/compute-dates";

/** Détermine la phase de garantie à la date `incidentIso` */
export function resolveWarrantyPhase(
  deliveryIso: string,
  incidentIso: string,
): WarrantyPhase {
  const { gpaEndDate, biennaleEndDate, decennaleEndDate } =
    computeWarrantyDatesByMonth(deliveryIso);
  const t = incidentIso.slice(0, 10);
  if (t < gpaEndDate) return "GPA_ACTIVE";
  if (t < biennaleEndDate) return "BIENNALE_ACTIVE";
  if (t < decennaleEndDate) return "DECENNALE_ACTIVE";
  return "POST_WARRANTY";
}

/**
 * Routage automatique selon votre cahier des charges :
 * - GPA active → GPA interne ou bailleur
 * - Biennale → constructeur
 * - Décennale → assurance décennale
 * - Sinon artisan / bailleur
 */
export function suggestTicketRouting(
  residence: Pick<Residence, "deliveryDate" | "hasInternalGPAService">,
  incidentDateIso: string,
): TicketRoutingSuggestion {
  const phase = resolveWarrantyPhase(residence.deliveryDate, incidentDateIso);
  switch (phase) {
    case "GPA_ACTIVE":
      return {
        phase,
        assignTo: "GPA_INTERNAL_OR_LANDLORD",
        labelFr: residence.hasInternalGPAService
          ? "Garantie de parfait achèvement (GPA) : orienter vers le service GPA interne ou le bailleur."
          : "GPA : orienter vers le bailleur (pas de GPA interne déclaré sur la résidence).",
      };
    case "BIENNALE_ACTIVE":
      return {
        phase,
        assignTo: "CONSTRUCTOR",
        labelFr: "Garantie biennale (bon fonctionnement équipements) : orienter vers le constructeur / lotisseur selon dossier.",
      };
    case "DECENNALE_ACTIVE":
      return {
        phase,
        assignTo: "DECENNALE_INSURER",
        labelFr: "Garantie décennale (gros ouvrage) : orienter vers l’assureur décennale / constructeur désigné au contrat.",
      };
    default:
      return {
        phase: "POST_WARRANTY",
        assignTo: "CRAFTSMAN_OR_LANDLORD",
        labelFr:
          "Hors périodes de garantie légales déclaratives : artisan ou équipe bailleur selon périmètre charge / base locative.",
      };
  }
}
