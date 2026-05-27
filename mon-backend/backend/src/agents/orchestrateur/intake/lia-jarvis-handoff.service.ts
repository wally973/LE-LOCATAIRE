import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { mergeAiLastDecision } from './lia-intake.service';
import {
  JARVIS_HANDOFF_TARGET,
  JARVIS_HANDOFF_TENANT_MESSAGE_FR,
} from './lia-jarvis-visual-logic';
import type { LiaIntakeState } from './lia-intake.service';

/** Sixième sens — dispatch ticket enrichi vers le technicien référent de secteur. */
@Injectable()
export class LiaJarvisHandoffService {
  private readonly logger = new Logger(LiaJarvisHandoffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async dispatchSectorTechnician(params: {
    ticketId: number;
    intake?: LiaIntakeState | null;
    reason: string;
    visualizationNote?: string;
  }): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        housing: {
          include: {
            landlord: { include: { user: true } },
            agence: true,
          },
        },
        tenant: { include: { user: true } },
      },
    });
    if (!ticket) return;

    const enrichedBrief = [
      `Signalement : ${ticket.title}`,
      ticket.description,
      params.visualizationNote ? `Visualisation Lia : ${params.visualizationNote}` : '',
      params.reason,
      params.intake?.jarvisFacts
        ? `Faits : ${JSON.stringify(params.intake.jarvisFacts)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const handoffPayload = {
      target: JARVIS_HANDOFF_TARGET,
      at: new Date().toISOString(),
      reason: params.reason,
      enrichedBrief,
    };

    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        status: 'OPEN',
        responsibility: 'ESCALADE_BAILLEUR',
        escalatedAt: new Date(),
        escalationReason: `Jarvis — ${params.reason.slice(0, 200)}`,
        aiLastDecision: mergeAiLastDecision(ticket.aiLastDecision, {
          jarvisHandoff: handoffPayload,
          messageForTenant: JARVIS_HANDOFF_TENANT_MESSAGE_FR,
        }) as object,
      },
    });

    const landlordUserId = ticket.housing.landlord.userId;
    const ref = ticket.caseNumber ?? `#${ticket.id}`;
    await this.notifications.createNotification({
      userId: landlordUserId,
      title: 'Dossier complexe — expertise terrain',
      message: `${ref} : ${ticket.title}. Lia transmet au référent secteur.`,
      type: 'WARNING',
    });

    const agents = await this.prisma.agentProfile.findMany({
      where: {
        landlordProfileId: ticket.landlordProfileId ?? ticket.housing.landlordId,
        ...(ticket.housing.agenceId
          ? { agenceId: ticket.housing.agenceId }
          : {}),
      },
      include: { user: true },
    });

    for (const agent of agents) {
      await this.notifications.createNotification({
        userId: agent.userId,
        title: 'Intervention secteur demandée',
        message: `${ref} — ${ticket.housing.address}. ${params.reason.slice(0, 120)}`,
        type: 'WARNING',
      });
    }

    this.logger.log(
      `Handoff ${JARVIS_HANDOFF_TARGET} ticket #${params.ticketId} → bailleur + ${agents.length} agent(s)`,
    );
  }
}
