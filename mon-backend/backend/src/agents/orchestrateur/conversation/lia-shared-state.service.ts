import { Injectable } from '@nestjs/common';
import type { TicketResponsibility, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import type { QualificationFlags } from '../feature-flags/qualification-flags.types';
import {
  isFollowUpClosed,
  buildIntakePayload,
  mergeAiLastDecision,
  parseIntakeState,
  type LiaIntakeState,
} from './lia-intake.service';
import { parseCompanionState } from './lia-companion.types';
import {
  type AgentMemory,
  type LiaSharedState,
  parseAgentMemory,
} from './lia-goals.types';
import { parseExpertRectification } from './lia-expert-rectification.types';
import { parseDiagnosticState } from './lia-diagnostic-state.types';

@Injectable()
export class LiaSharedStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async load(
    ticketId: number,
    tenantUserId: number,
    opts?: { lastTenantMessage?: string },
  ): Promise<LiaSharedState> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { tenant: true },
    });
    if (!ticket) throw new Error('Ticket introuvable');

    const flags = await this.qualFlags(ticket.landlordProfileId);
    const artisan = await this.prisma.artisanRequest.findUnique({
      where: { ticketId },
      select: { id: true },
    });
    const ai = ticket.aiLastDecision;
    const declined =
      ai != null &&
      typeof ai === 'object' &&
      (ai as { artisanDeclined?: boolean }).artisanDeclined === true;

    const expertRectification = parseExpertRectification(ai);

    return {
      ticketId,
      tenantUserId,
      title: ticket.title,
      description: ticket.description,
      tenantFirstName: ticket.tenant.firstName ?? '',
      status: ticket.status,
      responsibility: ticket.responsibility as TicketResponsibility,
      landlordProfileId: ticket.landlordProfileId,
      flags,
      intake: parseIntakeState(ai),
      companion: parseCompanionState(ai),
      followUpClosed: isFollowUpClosed(ai),
      artisanDeclined: declined,
      hasArtisanRequest: artisan != null,
      agent: parseAgentMemory(ai),
      expertRectification,
      diagnosticAuthority: expertRectification
        ? 'EXPERT_VALIDATED'
        : 'AI_PROPOSED',
      diagnostic: parseDiagnosticState(ai),
      lastTenantMessage: opts?.lastTenantMessage,
    };
  }

  async persistAgentMemory(
    ticketId: number,
    agent: AgentMemory,
    intake?: ReturnType<typeof parseIntakeState>,
  ): Promise<void> {
    const row = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { aiLastDecision: true },
    });
    const patch: Record<string, unknown> = { agent };
    if (intake) {
      Object.assign(patch, { intake });
    }
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        aiLastDecision: mergeAiLastDecision(row?.aiLastDecision, patch) as object,
      },
    });
  }

  async updateTicketStatus(ticketId: number, status: TicketStatus): Promise<void> {
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    });
  }

  /** État intake initial avant le premier react(TICKET_OPENED). */
  async seedInitialState(
    ticketId: number,
    intake: LiaIntakeState,
    status: TicketStatus = 'OPEN',
  ): Promise<void> {
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        aiLastDecision: buildIntakePayload(intake) as object,
      },
    });
  }

  private async qualFlags(
    landlordProfileId: number | null,
  ): Promise<QualificationFlags> {
    if (landlordProfileId == null) {
      return this.featureFlags.pickQualificationFlags({});
    }
    return this.featureFlags.getQualificationFlags(landlordProfileId);
  }
}
