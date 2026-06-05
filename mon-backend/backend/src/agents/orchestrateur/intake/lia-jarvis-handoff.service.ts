import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { ArtisanRequestsService } from '../../../artisan-requests/artisan-requests.service';
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
    private readonly artisanRequests: ArtisanRequestsService,
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

  /** Handoff volet social — détresse financière après pivot dialogue Jarvis. */
  async dispatchSocialReferral(params: {
    ticketId: number;
    tenantMessage: string;
    intake?: LiaIntakeState | null;
    reason?: string;
  }): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        housing: { include: { landlord: { include: { user: true } } } },
        tenant: { include: { user: true } },
      },
    });
    if (!ticket) return;

    const bailleurId = ticket.landlordProfileId ?? ticket.housing.landlordId;
    const notes =
      params.reason ??
      `Pivot social Jarvis — détresse financière locataire : ${params.tenantMessage.slice(0, 300)}`;

    const existing = await this.prisma.socialCase.findUnique({
      where: { triggerTicketId: params.ticketId },
    });
    if (!existing) {
      await this.prisma.socialCase.create({
        data: {
          tenantId: ticket.tenantId,
          bailleurId,
          status: 'OPEN',
          category: 'SOCIAL',
          notes,
          triggerTicketId: params.ticketId,
        },
      });
    }

    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        aiLastDecision: mergeAiLastDecision(ticket.aiLastDecision, {
          socialFlag: true,
          socialHandoff: {
            at: new Date().toISOString(),
            reason: notes,
            source: 'jarvis_dialogue_pivot',
          },
        }) as object,
      },
    });

    const ref = ticket.caseNumber ?? `#${ticket.id}`;
    await this.notifications.createNotification({
      userId: ticket.housing.landlord.userId,
      title: 'Dossier social — aide exceptionnelle à étudier',
      message: `${ref} : ${ticket.title}. Lia a transmis une demande au volet social (détresse financière locataire).`,
      type: 'WARNING',
    });

    this.logger.log(`Handoff social ticket #${params.ticketId} → dossier social + admin bailleur`);
  }

  /** Demande artisan serrurier — charge locataire, ticket urgent Admin. */
  async dispatchArtisanReferral(params: {
    ticketId: number;
    tenantMessage: string;
    reason?: string;
  }): Promise<void> {
    const reason =
      params.reason ??
      `Aide serrurier demandée (charge locataire) : ${params.tenantMessage.slice(0, 300)}`;

    await this.artisanRequests.createFromJarvisReferral({
      ticketId: params.ticketId,
      reason,
      urgent: true,
    });

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
    });
    if (ticket) {
      await this.prisma.ticket.update({
        where: { id: params.ticketId },
        data: {
          aiLastDecision: mergeAiLastDecision(ticket.aiLastDecision, {
            artisanReferral: {
              at: new Date().toISOString(),
              reason,
              source: 'jarvis_tenant_charge_locksmith',
              urgent: true,
            },
          }) as object,
        },
      });
    }

    this.logger.log(
      `Handoff artisan urgent ticket #${params.ticketId} → ArtisanRequest + admins`,
    );
  }
}
