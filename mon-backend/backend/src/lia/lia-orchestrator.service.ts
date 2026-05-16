import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiRoutingService } from '../ai-routing/ai-routing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ArtisanRequestsService } from '../artisan-requests/artisan-requests.service';
import { LiaHostService } from './lia-host.service';
import { LiaConversationService } from './lia-conversation.service';

/**
 * Chef d'orchestre LIA — accueil synchrone, analyse technique/juridique en arrière-plan.
 * Le locataire peut fermer l'app après le 1er message ; push à la fin d'analyse.
 */
@Injectable()
export class LiaOrchestratorService {
  private readonly logger = new Logger(LiaOrchestratorService.name);
  /** Évite deux analyses concurrentes sur le même ticket. */
  private readonly analyzing = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouting: AiRoutingService,
    private readonly notifications: NotificationsService,
    private readonly artisanRequests: ArtisanRequestsService,
    private readonly host: LiaHostService,
    private readonly conversation: LiaConversationService,
  ) {}

  /**
   * Démarre le fil : message locataire + accueil Lia, puis analyse async.
   */
  async startTicketConversation(ticketId: number, tenantUserId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: { include: { user: true } },
      },
    });
    if (!ticket) throw new Error('Ticket introuvable');

    await this.conversation.appendMessage(
      ticketId,
      'TENANT',
      this.formatInitialTenantMessage(ticket.title, ticket.description),
    );

    const welcome = await this.host.welcomeAfterTicket({
      tenantFirstName: ticket.tenant.firstName,
      title: ticket.title,
    });

    await this.conversation.appendMessage(ticketId, 'LIA_HOST', welcome.text);

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'LIA_ANALYZING' },
    });

    await this.notifications.notifyUser(
      ticket.tenant.userId,
      {
        title: 'Lia a bien reçu votre demande',
        message: welcome.text.slice(0, 200),
        type: 'INFO',
      },
      { sendPush: true, ticketId },
    );

    this.runAnalysisInBackground(ticketId);

    return this.conversation.listMessages(ticketId, tenantUserId, 'LOCATAIRE');
  }

  /**
   * Message locataire pendant le dossier (précision, demande d'artisan, etc.).
   */
  async onTenantMessage(ticketId: number, tenantUserId: number, text: string) {
    await this.conversation.assertCanAccessTicket(
      ticketId,
      tenantUserId,
      'LOCATAIRE',
    );

    const trimmed = text.trim();
    await this.conversation.appendMessage(ticketId, 'TENANT', trimmed);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { tenant: true },
    });
    if (!ticket) throw new Error('Ticket introuvable');

    if (this.isArtisanIntent(trimmed)) {
      const reply = await this.handleArtisanIntent(
        ticketId,
        tenantUserId,
        ticket.responsibility,
        trimmed,
      );
      await this.conversation.appendMessage(ticketId, 'LIA_HOST', reply);
      return this.conversation.listMessages(ticketId, tenantUserId, 'LOCATAIRE');
    }

    const ack = await this.host.acknowledgeTenantReply({ tenantMessage: trimmed });
    await this.conversation.appendMessage(ticketId, 'LIA_HOST', ack.text);

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'LIA_ANALYZING' },
    });

    this.runAnalysisInBackground(ticketId, trimmed);

    return this.conversation.listMessages(ticketId, tenantUserId, 'LOCATAIRE');
  }

  /** Analyse patho/juriste (pipeline existant) sans bloquer la requête HTTP. */
  runAnalysisInBackground(ticketId: number, tenantFeedback?: string) {
    if (this.analyzing.has(ticketId)) return;
    this.analyzing.add(ticketId);
    setImmediate(() => {
      void this.executeBackgroundAnalysis(ticketId, tenantFeedback);
    });
  }

  private formatInitialTenantMessage(title: string, description: string): string {
    const t = title.trim();
    const d = description.trim();
    if (!d || t === d) return t || d;
    if (t && !d) return t;
    return `${t}\n\n${d}`;
  }

  private isArtisanIntent(text: string): boolean {
    const t = text.toLowerCase();
    const keywords = [
      'plombier',
      'électricien',
      'electricien',
      'serrurier',
      'artisan',
      'devis',
      'envoyer un',
      'envoyez un',
      'je voudrais',
      'je veux',
      'je souhaite',
      'j\'aimerais',
      'demander un',
      'demande un',
      'intervention',
      'prestataire',
    ];
    return keywords.some((k) => t.includes(k));
  }

  private resolveArtisanLabel(text: string): string {
    const t = text.toLowerCase();
    if (t.includes('plombier') || t.includes('fuite')) return 'plombier';
    if (t.includes('électric') || t.includes('electric')) return 'électricien';
    if (t.includes('serrur')) return 'serrurier';
    return 'artisan';
  }

  private async handleArtisanIntent(
    ticketId: number,
    tenantUserId: number,
    responsibility: string,
    tenantMessage: string,
  ): Promise<string> {
    const label = this.resolveArtisanLabel(tenantMessage);

    if (responsibility !== 'LOCATAIRE') {
      return (
        responsibility === 'BAILLEUR' || responsibility === 'ESCALADE_BAILLEUR'
          ? 'Cette intervention est à la charge du bailleur : un agent va vous recontacter. ' +
              'Vous n’avez pas besoin de commander un artisan vous-même.'
          : 'Pour l’instant, une demande d’artisan n’est pas possible sur ce dossier. ' +
              'Un agent du bailleur va vous accompagner.'
      );
    }

    try {
      await this.artisanRequests.createFromTicket(tenantUserId, ticketId, {
        reason: tenantMessage,
      });
      const reply = await this.host.confirmArtisanRequest({
        artisanLabel: label,
      });
      return reply.text;
    } catch (e) {
      if (e instanceof ConflictException) {
        const reply = await this.host.confirmArtisanRequest({
          artisanLabel: label,
          alreadyExists: true,
        });
        return reply.text;
      }
      this.logger.error(`Demande artisan ticket #${ticketId}`, e);
      return (
        'Je n’ai pas pu enregistrer la demande d’artisan pour le moment. ' +
        'Réessayez dans un instant ou contactez votre bailleur.'
      );
    }
  }

  private async executeBackgroundAnalysis(
    ticketId: number,
    tenantFeedback?: string,
  ) {
    try {
      const updated = await this.aiRouting.analyzeTicket(ticketId, {
        force: true,
        tenantFeedback,
      });

      const decision = updated.aiLastDecision as {
        messageForTenant?: string;
      } | null;
      const finalText =
        decision?.messageForTenant ??
        'Votre dossier a été analysé. Ouvrez l’application pour voir le détail.';

      const lastHost = await this.prisma.ticketMessage.findFirst({
        where: { ticketId, role: 'LIA_HOST' },
        orderBy: { createdAt: 'desc' },
      });
      if (lastHost?.content.trim() !== finalText.trim()) {
        await this.conversation.appendMessage(ticketId, 'LIA_HOST', finalText);
      }
    } catch (e) {
      this.logger.error(`Analyse LIA ticket #${ticketId}`, e);
      await this.conversation.appendMessage(
        ticketId,
        'LIA_SYSTEM',
        'Une difficulté technique est survenue. Un agent du bailleur reprendra votre dossier.',
      );
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { tenant: true },
      });
      if (ticket?.tenant.userId) {
        await this.notifications.notifyUser(
          ticket.tenant.userId,
          {
            title: 'Mise à jour sur votre demande',
            message:
              'Nous rencontrons un retard technique. Vous serez recontacté(e) rapidement.',
            type: 'WARNING',
          },
          { sendPush: true, ticketId },
        );
      }
    } finally {
      this.analyzing.delete(ticketId);
    }
  }
}
