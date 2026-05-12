import type { Residence } from "@/types";
import type { LogementEntretienPlan } from "@/types";
import type { Ticket, TicketCategoryHint, TicketStatus } from "@/types";
import type {
  HlmLogementEntretienDto,
  HlmResidenceDto,
  HlmTicketDto,
} from "@/lib/api/hlm-types";

export function mapResidenceDto(r: HlmResidenceDto): Residence {
  return {
    id: r.reference,
    name: r.name,
    bailleurId: r.bailleurReference,
    constructionYear: r.constructionYear,
    deliveryDate: r.deliveryDateIso.slice(0, 10),
    residenceNeuve: r.residenceNeuve,
    hasInternalGPAService: r.hasInternalGPAServicePerResidence,
  };
}

export function mapLogementEntretienPlan(
  d: HlmLogementEntretienDto,
): LogementEntretienPlan {
  const next =
    d.nextDueAtIso?.slice(0, 10) ??
    new Date().toISOString().slice(0, 10);
  return {
    id: d.reference,
    logementId: d.logementReference,
    entretienTypeCode: d.code,
    nextDueAt: next,
    lastCompletedAt: d.lastCompletedAtIso ?? undefined,
  };
}

export function mapTicketDto(t: HlmTicketDto): Ticket {
  return {
    id: t.reference,
    logementId: t.logementReference,
    title: t.title,
    description: t.description ?? undefined,
    status: t.status as TicketStatus,
    categoryHint: t.category as TicketCategoryHint,
    blockedReason: t.blockedReason ?? undefined,
    routingLabelFr: t.routingNotes ?? undefined,
    createdAt: t.createdAtIso,
  };
}
