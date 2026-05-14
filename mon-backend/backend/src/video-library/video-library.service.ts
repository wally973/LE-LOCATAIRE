import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VIDEO_SEARCH } from './video-search.port';
import type { VideoSearchPort } from './video-search.port';
import { VideoFeedbackDto } from './dto/video-feedback.dto';

/** Stop-words français basiques pour la normalisation de query. */
const STOP_WORDS = new Set([
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'de',
  'du',
  'au',
  'aux',
  'mon',
  'ma',
  'mes',
  'ton',
  'ta',
  'tes',
  'son',
  'sa',
  'ses',
  'et',
  'ou',
  'à',
  'a',
  'en',
  'dans',
  'sur',
  'sous',
  'avec',
  'sans',
  'pour',
  'par',
  'que',
  'qui',
  'pas',
  'plus',
  'est',
  'sont',
  'cest',
  'c',
]);

const MAX_VIDEOS_PER_TICKET = 3;

@Injectable()
export class VideoLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(VIDEO_SEARCH) private readonly videoSearch: VideoSearchPort,
  ) {}

  /**
   * Suggère des vidéos pour un ticket donné.
   *
   * Pipeline :
   *  1. normalise la query (title + description + category)
   *  2. cherche un VideoTutorialQuery existant (cache)
   *  3. si miss : appelle l'adapter et archive les résultats
   *  4. crée les TicketVideoSuggestion correspondantes (idempotent grâce au unique)
   *  5. notifie le locataire
   *
   * Sans-effet si le ticket est déjà clôturé (RESOLVED/AUTO_CLOSED/CANCELLED)
   * ou si des suggestions existent déjà pour ce ticket.
   */
  async suggestForTicket(ticketId: number): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: { include: { user: true } },
      },
    });
    if (!ticket) return;

    const closedStatuses = ['RESOLVED', 'AUTO_CLOSED', 'CANCELLED'];
    if (closedStatuses.includes(ticket.status as string)) return;
    if (ticket.responsibility !== 'LOCATAIRE') return;

    const existing = await this.prisma.ticketVideoSuggestion.count({
      where: { ticketId },
    });
    if (existing > 0) return;

    const category = ticket.aiCategory ?? 'OTHER';
    const locale = 'fr-FR';
    const queryNormalized = this.normalizeQuery(
      `${ticket.title} ${ticket.description}`,
      category,
    );

    let videoQuery = await this.prisma.videoTutorialQuery.findUnique({
      where: {
        queryNormalized_locale: { queryNormalized, locale },
      },
      include: {
        videos: {
          where: { disabledByAdmin: false },
          orderBy: [{ validatedByAdmin: 'desc' }, { score: 'desc' }],
          take: MAX_VIDEOS_PER_TICKET,
        },
      },
    });

    if (!videoQuery) {
      videoQuery = await this.prisma.videoTutorialQuery.create({
        data: {
          queryNormalized,
          locale,
          category,
        },
        include: {
          videos: true,
        },
      });

      const results = await this.videoSearch.search({
        queryNormalized,
        category,
        locale,
        maxResults: MAX_VIDEOS_PER_TICKET,
      });

      for (const r of results) {
        await this.prisma.videoTutorial.upsert({
          where: {
            queryId_youtubeVideoId: {
              queryId: videoQuery.id,
              youtubeVideoId: r.youtubeVideoId,
            },
          },
          create: {
            queryId: videoQuery.id,
            youtubeVideoId: r.youtubeVideoId,
            title: r.title,
            channel: r.channel,
            thumbnailUrl: r.thumbnailUrl,
            durationSec: r.durationSec,
            language: r.language,
            score: r.score,
          },
          update: {
            score: r.score,
          },
        });
      }

      videoQuery = await this.prisma.videoTutorialQuery.findUnique({
        where: { id: videoQuery.id },
        include: {
          videos: {
            where: { disabledByAdmin: false },
            orderBy: [{ validatedByAdmin: 'desc' }, { score: 'desc' }],
            take: MAX_VIDEOS_PER_TICKET,
          },
        },
      });
    } else {
      await this.prisma.videoTutorialQuery.update({
        where: { id: videoQuery.id },
        data: {
          hitCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }

    if (!videoQuery || videoQuery.videos.length === 0) return;

    for (const v of videoQuery.videos) {
      await this.prisma.ticketVideoSuggestion.upsert({
        where: {
          ticketId_videoTutorialId: {
            ticketId,
            videoTutorialId: v.id,
          },
        },
        create: {
          ticketId,
          videoTutorialId: v.id,
        },
        update: {},
      });
    }

    await this.notifications.createNotification({
      userId: ticket.tenant.userId,
      title: 'Tutoriel disponible',
      message:
        'Nous avons trouvé une ou plusieurs vidéos qui peuvent vous aider à régler ce problème vous-même.',
      type: 'INFO',
    });
  }

  /**
   * Liste des vidéos proposées au locataire pour un ticket.
   * Vérifie que le ticket appartient au locataire avant de répondre.
   */
  async getSuggestionsForTicket(tenantUserId: number, ticketId: number) {
    await this.assertTenantOwnsTicket(tenantUserId, ticketId);

    return this.prisma.ticketVideoSuggestion.findMany({
      where: { ticketId },
      orderBy: { suggestedAt: 'asc' },
      include: {
        video: {
          select: {
            id: true,
            youtubeVideoId: true,
            title: true,
            channel: true,
            thumbnailUrl: true,
            durationSec: true,
            language: true,
            score: true,
            validatedByAdmin: true,
          },
        },
      },
    });
  }

  /**
   * Met à jour le retour locataire sur une vidéo suggérée.
   * Si helpful=true → marque le ticket en RESOLVED (P2 décidé : immédiat).
   */
  async submitFeedback(
    tenantUserId: number,
    ticketId: number,
    suggestionId: number,
    dto: VideoFeedbackDto,
  ) {
    await this.assertTenantOwnsTicket(tenantUserId, ticketId);

    const suggestion = await this.prisma.ticketVideoSuggestion.findUnique({
      where: { id: suggestionId },
    });
    if (!suggestion || suggestion.ticketId !== ticketId) {
      throw new NotFoundException('Suggestion vidéo introuvable');
    }

    const updated = await this.prisma.ticketVideoSuggestion.update({
      where: { id: suggestionId },
      data: {
        tenantWatched:
          dto.watched !== undefined
            ? dto.watched
            : suggestion.tenantWatched || dto.helpful !== undefined,
        tenantHelpful:
          dto.helpful !== undefined ? dto.helpful : suggestion.tenantHelpful,
        tenantFeedback: dto.feedback ?? suggestion.tenantFeedback,
      },
    });

    return updated;
  }

  /**
   * Marque le ticket RESOLVED suite à une vidéo utile.
   * Endpoint séparé pour rester explicite côté UX mobile.
   */
  async markResolvedByVideo(tenantUserId: number, ticketId: number) {
    await this.assertTenantOwnsTicket(tenantUserId, ticketId);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        housing: { include: { landlord: { include: { user: true } } } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');

    if (ticket.responsibility !== 'LOCATAIRE') {
      throw new BadRequestException(
        'Ce ticket n’est pas à votre charge ; vous ne pouvez pas le clôturer ainsi.',
      );
    }
    if (['RESOLVED', 'AUTO_CLOSED', 'CANCELLED'].includes(ticket.status)) {
      throw new BadRequestException('Ce ticket est déjà clôturé.');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        resolutionNote:
          ticket.resolutionNote ??
          'Résolu par le locataire grâce à un tutoriel vidéo (Sprint 4).',
      },
    });

    await this.notifications.createNotification({
      userId: tenantUserId,
      title: 'Ticket clôturé',
      message: 'Merci, votre ticket a été marqué comme résolu.',
      type: 'INFO',
    });

    return updated;
  }

  // --------------------------------------------------------------------------
  // Admin
  // --------------------------------------------------------------------------

  /**
   * Backoffice admin — listing complet de la vidéothèque.
   */
  async listLibrary() {
    return this.prisma.videoTutorialQuery.findMany({
      orderBy: [{ hitCount: 'desc' }, { lastUsedAt: 'desc' }],
      include: {
        videos: {
          orderBy: [{ validatedByAdmin: 'desc' }, { score: 'desc' }],
        },
      },
    });
  }

  /**
   * Backoffice admin — modération d'une vidéo (valider / désactiver).
   */
  async updateVideoModeration(
    videoId: number,
    body: { validatedByAdmin?: boolean; disabledByAdmin?: boolean },
  ) {
    const video = await this.prisma.videoTutorial.findUnique({
      where: { id: videoId },
    });
    if (!video) throw new NotFoundException('Vidéo introuvable');

    return this.prisma.videoTutorial.update({
      where: { id: videoId },
      data: {
        validatedByAdmin:
          body.validatedByAdmin !== undefined
            ? body.validatedByAdmin
            : video.validatedByAdmin,
        disabledByAdmin:
          body.disabledByAdmin !== undefined
            ? body.disabledByAdmin
            : video.disabledByAdmin,
      },
    });
  }

  // --------------------------------------------------------------------------
  // Helpers internes
  // --------------------------------------------------------------------------

  /**
   * Normalise une question texte : lowercase, retire la ponctuation et
   * les stop-words FR, dé-double les espaces, plafonne la longueur.
   * Utilisé comme clé de cache (queryNormalized + locale).
   */
  private normalizeQuery(text: string, category: string): string {
    const cleaned = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
      .sort()
      .join(' ')
      .slice(0, 240);
    return `${category}:${cleaned}`;
  }

  private async assertTenantOwnsTicket(
    tenantUserId: number,
    ticketId: number,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { tenant: true },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');
    if (ticket.tenant.userId !== tenantUserId) {
      throw new ForbiddenException('Ce ticket ne vous appartient pas.');
    }
  }
}
