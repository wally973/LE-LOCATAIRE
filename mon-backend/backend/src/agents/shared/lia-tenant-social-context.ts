/**
 * Profil social locataire — paysage injecté dans DiagnosticContext et pont Groq.
 */
import type { PrismaClient, Role } from '@prisma/client';
import { parseIntakeState } from '../orchestrateur/intake/lia-intake.service';
import {
  buildContinuityLandscape,
  buildRelationalMirrorLandscape,
  type LiaInterlocutorRole,
  type LiaTenantAgeBand,
  type LiaTenantSocialContext,
} from './lia-jarvis-identity';

const CLOSED_STATUSES = ['RESOLVED', 'AUTO_CLOSED'] as const;

function inferAgeBand(hints?: {
  ageBand?: LiaTenantAgeBand;
  firstName?: string;
}): LiaTenantAgeBand {
  if (hints?.ageBand && hints.ageBand !== 'unknown') return hints.ageBand;
  return 'unknown';
}

function inferInterlocutorRole(
  userRole: Role | undefined,
  hint?: LiaInterlocutorRole,
): LiaInterlocutorRole {
  if (hint) return hint;
  if (userRole && userRole !== 'LOCATAIRE') return 'staff_tester';
  return 'tenant';
}

function closureSummary(ticket: {
  title: string;
  resolutionNote: string | null;
  aiLastDecision: unknown;
}): string {
  if (ticket.resolutionNote?.trim()) {
    return ticket.resolutionNote.trim().slice(0, 400);
  }
  const intake = parseIntakeState(ticket.aiLastDecision);
  const fromJarvis = intake?.answers?.jarvis_summary?.trim();
  if (fromJarvis) return fromJarvis.slice(0, 400);
  return ticket.title.trim();
}

function formatTicketHistoryLandscape(
  tickets: Array<{
    caseNumber: string | null;
    title: string;
    status: string;
    updatedAt: Date;
  }>,
): string {
  if (!tickets.length) {
    return 'Historique dossiers : aucun autre ticket récent connu sur ce logement.';
  }
  const lines = tickets.slice(0, 4).map((t) => {
    const ref = t.caseNumber ?? `#${t.status}`;
    return `- ${ref} (${t.status}) : ${t.title}`;
  });
  return ['Historique dossiers récents (mémoire du voisinage) :', ...lines].join('\n');
}

/** Charge le paysage social depuis la base (ticket production). */
export async function loadTenantSocialContext(
  prisma: PrismaClient,
  params: {
    tenantId: number;
    excludeTicketId?: number;
    displayNameOverride?: string;
    ageBandHint?: LiaTenantAgeBand;
    interlocutorRoleHint?: LiaInterlocutorRole;
    currentTitle?: string;
  },
): Promise<LiaTenantSocialContext> {
  const tenant = await prisma.tenantProfile.findUnique({
    where: { id: params.tenantId },
    include: {
      user: { select: { role: true } },
    },
  });

  const displayName =
    params.displayNameOverride?.trim() ||
    tenant?.firstName?.trim() ||
    'Marie';
  const ageBand = inferAgeBand({
    ageBand: params.ageBandHint,
    firstName: displayName,
  });
  const interlocutorRole = inferInterlocutorRole(
    tenant?.user?.role,
    params.interlocutorRoleHint,
  );

  const recentTickets = await prisma.ticket.findMany({
    where: {
      tenantId: params.tenantId,
      ...(params.excludeTicketId ? { id: { not: params.excludeTicketId } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      caseNumber: true,
      title: true,
      status: true,
      resolutionNote: true,
      aiLastDecision: true,
      updatedAt: true,
    },
  });

  const lastClosedRow = recentTickets.find((t) =>
    CLOSED_STATUSES.includes(t.status as (typeof CLOSED_STATUSES)[number]),
  );

  const lastClosedTicket = lastClosedRow
    ? {
        caseNumber: lastClosedRow.caseNumber,
        title: lastClosedRow.title,
        summary: closureSummary(lastClosedRow),
        closedAt: lastClosedRow.updatedAt.toISOString().slice(0, 10),
      }
    : null;

  return {
    displayName,
    ageBand,
    interlocutorRole,
    relationalLandscape: buildRelationalMirrorLandscape({
      displayName,
      ageBand,
      interlocutorRole,
    }),
    ticketHistoryLandscape: formatTicketHistoryLandscape(recentTickets),
    lastClosedTicket,
    continuityLandscape: buildContinuityLandscape({
      currentTitle: params.currentTitle ?? '',
      lastClosed: lastClosedTicket,
    }),
  };
}

/** Paysage social Lia-Lab / essais sans ticket persisté. */
export function buildLabTenantSocialContext(params: {
  tenantFirstName?: string;
  ageBand?: LiaTenantAgeBand;
  interlocutorRole?: LiaInterlocutorRole;
  lastClosedTicketSummary?: string;
  lastClosedTicketTitle?: string;
  currentTitle?: string;
}): LiaTenantSocialContext {
  const displayName = params.tenantFirstName?.trim() || 'Marie';
  const ageBand = inferAgeBand({
    ageBand: params.ageBand,
    firstName: displayName,
  });
  const interlocutorRole = params.interlocutorRole ?? 'tenant';

  const lastClosedTicket =
    params.lastClosedTicketSummary?.trim()
      ? {
          caseNumber: null,
          title: params.lastClosedTicketTitle?.trim() || 'Dossier précédent',
          summary: params.lastClosedTicketSummary.trim().slice(0, 400),
          closedAt: 'récent',
        }
      : null;

  return {
    displayName,
    ageBand,
    interlocutorRole,
    relationalLandscape: buildRelationalMirrorLandscape({
      displayName,
      ageBand,
      interlocutorRole,
    }),
    ticketHistoryLandscape: lastClosedTicket
      ? `Historique dossiers : suite du dossier « ${lastClosedTicket.title} ».`
      : 'Historique dossiers : session Lia-Lab — premier fil unless preset fourni.',
    lastClosedTicket,
    continuityLandscape: buildContinuityLandscape({
      currentTitle: params.currentTitle ?? '',
      lastClosed: lastClosedTicket,
    }),
  };
}
