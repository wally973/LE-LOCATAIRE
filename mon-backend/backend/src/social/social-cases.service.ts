import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SocialCase,
  SocialCaseEventType,
  SocialCaseStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { BailleurScope } from '../auth/scope/bailleur-scope.types';
import { UpdateSocialCaseDto } from './dto/update-social-case.dto';
import { CreateSocialWorkerDto } from './dto/create-social-worker.dto';

const MAX_NOTES_LENGTH = 8000;

type AccessMode = 'admin' | 'landlord' | 'worker';

@Injectable()
export class SocialCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // --------------------------------------------------------------------------
  // Listings
  // --------------------------------------------------------------------------

  async listForAdmin(filters: {
    bailleurId?: number;
    status?: SocialCaseStatus;
    category?: string;
  }) {
    const where: Prisma.SocialCaseWhereInput = {};
    if (filters.bailleurId) where.bailleurId = filters.bailleurId;
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category as any;

    return this.prisma.socialCase.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
      include: this.listInclude(),
    });
  }

  async listForLandlord(scope: BailleurScope) {
    if (!scope.landlordProfileId) {
      throw new ForbiddenException('Portée bailleur introuvable.');
    }
    if (scope.role !== 'BAILLEUR' && scope.role !== 'AGENT') {
      throw new ForbiddenException('Accès réservé au bailleur ou à l’agent.');
    }

    return this.prisma.socialCase.findMany({
      where: { bailleurId: scope.landlordProfileId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
      include: this.listInclude(),
    });
  }

  /**
   * Référent social : uniquement les dossiers qui lui sont assignés (P2 défaut).
   */
  async listForAssignedWorker(socialWorkerId: number, bailleurId: number) {
    return this.prisma.socialCase.findMany({
      where: {
        bailleurId,
        assignedSocialWorkerId: socialWorkerId,
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
      include: this.listInclude(),
    });
  }

  // --------------------------------------------------------------------------
  // Détail
  // --------------------------------------------------------------------------

  async findOneForAdmin(id: number) {
    const c = await this.prisma.socialCase.findUnique({
      where: { id },
      include: this.detailInclude(),
    });
    if (!c) throw new NotFoundException('Dossier social introuvable');
    return c;
  }

  async findOneScoped(id: number, scope: BailleurScope, mode: AccessMode) {
    const c = await this.prisma.socialCase.findUnique({
      where: { id },
      include: this.detailInclude(),
    });
    if (!c) throw new NotFoundException('Dossier social introuvable');
    this.assertAccess(c, scope, mode);
    return c;
  }

  /**
   * Détail pour un référent social (sans BailleurScope — contexte issu du SocialWorkerGuard).
   */
  async findOneForSocialWorker(
    caseId: number,
    sw: { id: number; bailleurId: number },
  ) {
    const c = await this.prisma.socialCase.findUnique({
      where: { id: caseId },
      include: this.detailInclude(),
    });
    if (!c) throw new NotFoundException('Dossier social introuvable');
    if (c.bailleurId !== sw.bailleurId) {
      throw new ForbiddenException('Organisme non autorisé.');
    }
    if (c.assignedSocialWorkerId !== sw.id) {
      throw new ForbiddenException(
        'Vous ne pouvez consulter que les dossiers qui vous sont assignés.',
      );
    }
    return c;
  }

  /**
   * Locataire : vue limitée sans notes internes (P3).
   */
  async getActiveCaseForTenant(tenantUserId: number) {
    const tp = await this.prisma.tenantProfile.findUnique({
      where: { userId: tenantUserId },
    });
    if (!tp) {
      return { active: null as null };
    }

    const active = await this.prisma.socialCase.findFirst({
      where: {
        tenantId: tp.id,
        status: { in: ['OPEN', 'FOLLOW_UP'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        category: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        assignedSocialWorkerId: true,
      },
    });

    if (!active) {
      return { active: null as null };
    }

    return {
      active: {
        ...active,
        message:
          active.status === 'OPEN'
            ? 'Un dossier social est ouvert suite à votre demande. Un référent va vous contacter.'
            : 'Votre dossier social est en suivi.',
      },
    };
  }

  // --------------------------------------------------------------------------
  // Mise à jour
  // --------------------------------------------------------------------------

  async updateForAdmin(id: number, dto: UpdateSocialCaseDto, actorUserId: number) {
    const existing = await this.findOneForAdmin(id);
    return this.applyPatch(existing, dto, actorUserId, 'admin');
  }

  async updateForLandlord(
    id: number,
    dto: UpdateSocialCaseDto,
    scope: BailleurScope,
    actorUserId: number,
  ) {
    const existing = await this.findOneScoped(id, scope, 'landlord');
    return this.applyPatch(existing, dto, actorUserId, 'landlord');
  }

  async updateForWorker(
    id: number,
    dto: UpdateSocialCaseDto,
    sw: { id: number; bailleurId: number },
    actorUserId: number,
  ) {
    const existing = await this.findOneForSocialWorker(id, sw);
    return this.applyPatch(existing, dto, actorUserId, 'worker');
  }

  // --------------------------------------------------------------------------
  // Référents sociaux (CRUD bailleur)
  // --------------------------------------------------------------------------

  async listSocialWorkers(scope: BailleurScope) {
    if (!scope.landlordProfileId || (scope.role !== 'BAILLEUR' && scope.role !== 'AGENT')) {
      throw new ForbiddenException('Accès réservé au bailleur ou à l’agent.');
    }
    return this.prisma.socialWorker.findMany({
      where: { bailleurId: scope.landlordProfileId },
      include: { user: { select: { id: true, email: true, phone: true, role: true } } },
    });
  }

  async createSocialWorker(
    scope: BailleurScope,
    dto: CreateSocialWorkerDto,
  ) {
    if (!scope.landlordProfileId || (scope.role !== 'BAILLEUR' && scope.role !== 'AGENT')) {
      throw new ForbiddenException('Accès réservé au bailleur ou à l’agent.');
    }

    const target = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!target) throw new BadRequestException('Utilisateur cible introuvable.');

    try {
      return await this.prisma.socialWorker.create({
        data: {
          userId: dto.userId,
          bailleurId: scope.landlordProfileId,
          role: dto.role,
        },
        include: { user: { select: { id: true, email: true, phone: true, role: true } } },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException(
          'Cet utilisateur est déjà enregistré comme référent social pour votre organisme.',
        );
      }
      throw e;
    }
  }

  async deleteSocialWorker(scope: BailleurScope, workerId: number) {
    if (!scope.landlordProfileId || (scope.role !== 'BAILLEUR' && scope.role !== 'AGENT')) {
      throw new ForbiddenException('Accès réservé au bailleur ou à l’agent.');
    }
    const sw = await this.prisma.socialWorker.findFirst({
      where: { id: workerId, bailleurId: scope.landlordProfileId },
    });
    if (!sw) throw new NotFoundException('Référent social introuvable');

    await this.prisma.socialCase.updateMany({
      where: { assignedSocialWorkerId: workerId },
      data: { assignedSocialWorkerId: null },
    });

    await this.prisma.socialWorker.delete({ where: { id: workerId } });
    return { deleted: true };
  }

  // --------------------------------------------------------------------------
  // Internes
  // --------------------------------------------------------------------------

  private listInclude(): Prisma.SocialCaseInclude {
    return {
      tenant: { select: { id: true, firstName: true, lastName: true, userId: true } },
      assignedWorker: {
        select: { id: true, role: true, user: { select: { id: true, phone: true, email: true } } },
      },
      triggerTicket: { select: { id: true, title: true, status: true } },
    };
  }

  private detailInclude(): Prisma.SocialCaseInclude {
    return {
      ...this.listInclude(),
      bailleur: { select: { id: true, name: true } },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { actor: { select: { id: true, email: true, phone: true } } },
      },
    };
  }

  private assertAccess(c: SocialCase, scope: BailleurScope, mode: AccessMode) {
    if (mode === 'admin') {
      if (!scope.isAdmin) throw new ForbiddenException('Accès administrateur requis.');
      return;
    }
    if (mode === 'landlord') {
      if (!scope.landlordProfileId || c.bailleurId !== scope.landlordProfileId) {
        throw new ForbiddenException('Vous ne pouvez pas accéder à ce dossier.');
      }
      if (scope.role !== 'BAILLEUR' && scope.role !== 'AGENT') {
        throw new ForbiddenException('Accès réservé au bailleur ou à l’agent.');
      }
      return;
    }
    if (mode === 'worker') {
      if (!scope.socialWorkerId || c.assignedSocialWorkerId !== scope.socialWorkerId) {
        throw new ForbiddenException(
          'Vous ne pouvez accéder qu’aux dossiers qui vous sont assignés.',
        );
      }
      return;
    }
  }

  private async applyPatch(
    existing: SocialCase & { tenant: { userId: number } },
    dto: UpdateSocialCaseDto,
    actorUserId: number,
    actorRole: AccessMode,
  ) {
    let nextStatus = dto.status ?? existing.status;
    let nextNotes = existing.notes ?? '';
    let nextLastContact = dto.lastContactAt
      ? new Date(dto.lastContactAt)
      : existing.lastContactAt;
    let nextAssigned =
      dto.assignedSocialWorkerId !== undefined
        ? dto.assignedSocialWorkerId
        : existing.assignedSocialWorkerId;
    const nextCategory = dto.category ?? existing.category;
    const nextPriority = dto.priority ?? existing.priority;
    let nextClosedAt = existing.closedAt;
    let nextClosedReason = existing.closedReason;

    if (dto.noteAppend?.trim()) {
      const prefix = this.notePrefix(actorUserId);
      const chunk = `${prefix} ${dto.noteAppend.trim()}\n`;
      nextNotes = (nextNotes + chunk).slice(-MAX_NOTES_LENGTH);
      await this.recordEvent(existing.id, actorUserId, 'NOTE_ADDED', { length: dto.noteAppend.length });
    }

    if (dto.lastContactAt) {
      await this.recordEvent(existing.id, actorUserId, 'CONTACT_LOGGED', {
        at: dto.lastContactAt,
      });
    }

    // P5 : passage automatique OPEN → FOLLOW_UP dès contact ou note
    if (
      existing.status === 'OPEN' &&
      (dto.noteAppend?.trim() || dto.lastContactAt) &&
      !dto.status
    ) {
      nextStatus = 'FOLLOW_UP';
    }

    if (dto.status === 'CLOSED') {
      if (!dto.closedReason?.trim() || dto.closedReason.trim().length < 10) {
        throw new BadRequestException(
          'Le motif de clôture (closedReason) est obligatoire (min. 10 caractères).',
        );
      }
      nextClosedReason = dto.closedReason.trim();
      nextClosedAt = dto.closedAt ? new Date(dto.closedAt) : new Date();
      nextStatus = 'CLOSED';
    }

    if (dto.assignedSocialWorkerId !== undefined) {
      if (dto.assignedSocialWorkerId != null) {
        const sw = await this.prisma.socialWorker.findFirst({
          where: {
            id: dto.assignedSocialWorkerId,
            bailleurId: existing.bailleurId,
          },
        });
        if (!sw) {
          throw new BadRequestException(
            'Référent social inconnu ou rattaché à un autre bailleur.',
          );
        }
      }
      if (nextAssigned !== existing.assignedSocialWorkerId) {
        await this.recordEvent(existing.id, actorUserId, 'ASSIGNMENT', {
          from: existing.assignedSocialWorkerId,
          to: nextAssigned,
        });
        if (nextAssigned != null && existing.assignedSocialWorkerId !== nextAssigned) {
          await this.notifyTenantAssigned(existing.tenant.userId, existing.id);
        }
      }
    }

    if (nextStatus !== existing.status) {
      await this.recordEvent(existing.id, actorUserId, 'STATUS_CHANGE', {
        from: existing.status,
        to: nextStatus,
      });
    }

    if (dto.category && dto.category !== existing.category) {
      await this.recordEvent(existing.id, actorUserId, 'CATEGORY_CHANGE', {
        from: existing.category,
        to: nextCategory,
      });
    }

    const updated = await this.prisma.socialCase.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        category: nextCategory,
        priority: nextPriority,
        notes: nextNotes || null,
        assignedSocialWorkerId: nextAssigned,
        lastContactAt: nextLastContact,
        closedAt: nextClosedAt,
        closedReason: nextClosedReason,
      },
      include: this.detailInclude(),
    });

    if (nextStatus === 'FOLLOW_UP' && existing.status !== 'FOLLOW_UP') {
      await this.notifyTenantStatus(existing.tenant.userId, existing.id, 'FOLLOW_UP');
    }
    if (nextStatus === 'CLOSED' && existing.status !== 'CLOSED') {
      await this.notifyTenantStatus(existing.tenant.userId, existing.id, 'CLOSED');
      await this.closeLinkedTicketIfAny(existing);
    }

    return updated;
  }

  private notePrefix(actorUserId: number): string {
    const d = new Date();
    const iso = d.toISOString().slice(0, 16).replace('T', ' ');
    return `[${iso} UTC user#${actorUserId}]`;
  }

  private async recordEvent(
    socialCaseId: number,
    actorUserId: number,
    type: SocialCaseEventType,
    payload: Record<string, unknown> | null,
  ) {
    await this.prisma.socialCaseEvent.create({
      data: {
        socialCaseId,
        actorUserId,
        type,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  private async notifyTenantAssigned(tenantUserId: number, caseId: number) {
    await this.notifications.createNotification({
      userId: tenantUserId,
      title: 'Référent social désigné',
      message: `Un référent social a été désigné pour votre dossier #${caseId}.`,
      type: 'INFO',
    });
  }

  private async notifyTenantStatus(
    tenantUserId: number,
    caseId: number,
    status: SocialCaseStatus,
  ) {
    if (status === 'FOLLOW_UP') {
      await this.notifications.createNotification({
        userId: tenantUserId,
        title: 'Dossier social en suivi',
        message: `Votre dossier social #${caseId} est désormais en suivi.`,
        type: 'INFO',
      });
    } else if (status === 'CLOSED') {
      await this.notifications.createNotification({
        userId: tenantUserId,
        title: 'Dossier social clôturé',
        message: `Votre dossier social #${caseId} a été clôturé.`,
        type: 'INFO',
      });
    }
  }

  /** P4 : clôture du ticket déclencheur si présent. */
  private async closeLinkedTicketIfAny(c: SocialCase) {
    if (!c.triggerTicketId) return;
    await this.prisma.ticket.update({
      where: { id: c.triggerTicketId },
      data: {
        status: 'RESOLVED',
        resolutionNote:
          'Dossier social clôturé côté bailleur (volet social — Sprint 5).',
      },
    });
  }
}
