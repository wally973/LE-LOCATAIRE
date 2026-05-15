import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_ACTION, AUDIT_ENTITY } from './admin.constants';
import { CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';
import { CreateLandlordDto, UpdateLandlordDto } from './dto/landlord.dto';
import { StatsResponseDto } from './dto/stats.dto';
import {
  AdminUserListQueryDto,
  AuditLogQueryDto,
  HousingListQueryDto,
  HousingOccupancyFilter,
  UserStatusFilter,
} from './dto/list-query.dto';
import { SetUserAvailabilityDto } from './dto/set-availability.dto';

/** Utilisateur JWT tel que renvoyé par JwtStrategy */
export type AdminActor = {
  id?: number;
  userId?: number;
  email?: string | null;
};

/**
 * Service métier du module Admin : gestion des comptes, statistiques,
 * journal d’audit et listes paginées.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private actorId(actor: AdminActor): number {
    const raw = actor.userId ?? actor.id;
    if (raw == null || Number.isNaN(Number(raw))) {
      throw new ForbiddenException('Acteur non identifié');
    }
    return Number(raw);
  }

  /**
   * Enregistre une entrée dans le journal d’audit (fire-and-forget côté appelant).
   */
  private async recordAudit(
    actor: AdminActor,
    action: string,
    entityType: string,
    entityId?: number,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const id = this.actorId(actor);
    await this.prisma.adminAuditLog.create({
      data: {
        actorId: id,
        actorEmail: actor.email ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: metadata
          ? (metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  private buildAdminListWhere(
    query: AdminUserListQueryDto,
  ): Prisma.UserWhereInput {
    const search = query.search?.trim();
    const status = query.status ?? UserStatusFilter.ALL;

    const availabilityFilter: Prisma.UserWhereInput =
      status === UserStatusFilter.ACTIVE
        ? { isAvailable: true }
        : status === UserStatusFilter.INACTIVE
          ? { isAvailable: false }
          : {};

    const searchFilter: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {};

    return {
      role: 'ADMIN',
      ...availabilityFilter,
      ...searchFilter,
    };
  }

  private buildLandlordListWhere(
    query: AdminUserListQueryDto,
  ): Prisma.UserWhereInput {
    const search = query.search?.trim();
    const status = query.status ?? UserStatusFilter.ALL;

    const availabilityFilter: Prisma.UserWhereInput =
      status === UserStatusFilter.ACTIVE
        ? { isAvailable: true }
        : status === UserStatusFilter.INACTIVE
          ? { isAvailable: false }
          : {};

    const searchFilter: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            {
              landlord: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {};

    return {
      role: 'BAILLEUR',
      ...availabilityFilter,
      ...searchFilter,
    };
  }

  private buildHousingListWhere(
    query: HousingListQueryDto,
  ): Prisma.HousingWhereInput {
    const search = query.search?.trim();
    const occ = query.occupancy ?? HousingOccupancyFilter.ALL;

    const occupancyWhere: Prisma.HousingWhereInput =
      occ === HousingOccupancyFilter.OCCUPIED
        ? { currentTenant: { isNot: null } }
        : occ === HousingOccupancyFilter.VACANT
          ? { currentTenant: null }
          : {};

    const searchWhere: Prisma.HousingWhereInput = search
      ? {
          OR: [
            { address: { contains: search, mode: 'insensitive' } },
            { postalCode: { contains: search } },
          ],
        }
      : {};

    return {
      AND: [occupancyWhere, searchWhere],
    };
  }

  private paginationMeta(total: number, page: number, limit: number) {
    return {
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }

  // ==================== ADMIN MANAGEMENT ====================

  async createAdmin(dto: CreateAdminDto, actor: AdminActor) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
      },
    });

    if (existing) {
      throw new ConflictException(
        'Un compte existe déjà avec cet email ou ce numéro de téléphone',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        role: 'ADMIN',
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        isAvailable: true,
      },
    });

    await this.recordAudit(
      actor,
      AUDIT_ACTION.CREATE_ADMIN,
      AUDIT_ENTITY.USER,
      created.id,
      { email: created.email },
    );

    return created;
  }

  async listAdmins(query: AdminUserListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildAdminListWhere(query);

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          isAvailable: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: this.paginationMeta(total, page, limit) };
  }

  async getAdminById(id: number) {
    const admin = await this.prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        isAvailable: true,
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin introuvable');
    }

    return admin;
  }

  async updateAdmin(id: number, dto: UpdateAdminDto, actor: AdminActor) {
    const admin = await this.prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
    });

    if (!admin) {
      throw new NotFoundException('Admin introuvable');
    }

    if (dto.email || dto.phone) {
      const existing = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(dto.email ? [{ email: dto.email }] : []),
                ...(dto.phone ? [{ phone: dto.phone }] : []),
              ],
            },
          ],
        },
      });

      if (existing) {
        throw new ConflictException(
          'Un autre compte existe déjà avec cet email ou ce numéro',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.phone && { phone: dto.phone }),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        isAvailable: true,
      },
    });

    await this.recordAudit(actor, AUDIT_ACTION.UPDATE_ADMIN, AUDIT_ENTITY.USER, id, {
      fields: Object.keys(dto),
    });

    return updated;
  }

  async deleteAdmin(id: number, actor: AdminActor) {
    const admin = await this.prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
    });

    if (!admin) {
      throw new NotFoundException('Admin introuvable');
    }

    const actorId = this.actorId(actor);
    if (actorId === id) {
      throw new ForbiddenException('Vous ne pouvez pas supprimer votre propre compte');
    }

    const deleted = await this.prisma.user.delete({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    await this.recordAudit(actor, AUDIT_ACTION.DELETE_ADMIN, AUDIT_ENTITY.USER, id, {
      email: admin.email,
    });

    return deleted;
  }

  // ==================== LANDLORD MANAGEMENT ====================

  async createLandlord(dto: CreateLandlordDto, actor: AdminActor) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
      },
    });

    if (existing) {
      throw new ConflictException(
        'Un compte existe déjà avec cet email ou ce numéro de téléphone',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        role: 'BAILLEUR',
        landlord: {
          create: {
            name: dto.name,
            logoUrl: dto.logoUrl || null,
            featureFlags: { create: {} },
          },
        },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        isAvailable: true,
        landlord: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    });

    await this.recordAudit(
      actor,
      AUDIT_ACTION.CREATE_LANDLORD,
      AUDIT_ENTITY.USER,
      created.id,
      { name: dto.name },
    );

    return created;
  }

  async listLandlords(query: AdminUserListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildLandlordListWhere(query);

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          isAvailable: true,
          landlord: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              housings: {
                select: {
                  id: true,
                  address: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: this.paginationMeta(total, page, limit) };
  }

  async getLandlordById(id: number) {
    const landlord = await this.prisma.user.findFirst({
      where: { id, role: 'BAILLEUR' },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        isAvailable: true,
        landlord: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            housings: {
              select: {
                id: true,
                address: true,
                city: true,
                postalCode: true,
                country: true,
                isValidated: true,
                createdAt: true,
                currentTenant: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!landlord) {
      throw new NotFoundException('Bailleur introuvable');
    }

    return landlord;
  }

  async updateLandlord(id: number, dto: UpdateLandlordDto, actor: AdminActor) {
    const landlord = await this.prisma.user.findFirst({
      where: { id, role: 'BAILLEUR' },
    });

    if (!landlord) {
      throw new NotFoundException('Bailleur introuvable');
    }

    if (dto.email || dto.phone) {
      const existing = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(dto.email ? [{ email: dto.email }] : []),
                ...(dto.phone ? [{ phone: dto.phone }] : []),
              ],
            },
          ],
        },
      });

      if (existing) {
        throw new ConflictException(
          'Un autre compte existe déjà avec cet email ou ce numéro',
        );
      }
    }

    const needsLandlordUpdate =
      dto.name !== undefined || dto.logoUrl !== undefined;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.phone && { phone: dto.phone }),
        ...(needsLandlordUpdate && {
          landlord: {
            update: {
              ...(dto.name !== undefined && { name: dto.name }),
              ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
            },
          },
        }),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isAvailable: true,
        landlord: true,
      },
    });

    await this.recordAudit(actor, AUDIT_ACTION.UPDATE_LANDLORD, AUDIT_ENTITY.USER, id, {
      fields: Object.keys(dto),
    });

    return updated;
  }

  async deleteLandlord(id: number, actor: AdminActor) {
    const landlord = await this.prisma.user.findFirst({
      where: { id, role: 'BAILLEUR' },
    });

    if (!landlord) {
      throw new NotFoundException('Bailleur introuvable');
    }

    await this.prisma.landlordProfile.deleteMany({
      where: { userId: id },
    });

    const deleted = await this.prisma.user.delete({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    await this.recordAudit(actor, AUDIT_ACTION.DELETE_LANDLORD, AUDIT_ENTITY.USER, id, {
      email: landlord.email,
    });

    return deleted;
  }

  // ==================== HOUSINGS (ADMIN) ====================

  async listHousings(query: HousingListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildHousingListWhere(query);

    const [data, total] = await Promise.all([
      this.prisma.housing.findMany({
        where,
        select: {
          id: true,
          address: true,
          city: true,
          postalCode: true,
          country: true,
          isValidated: true,
          createdAt: true,
          landlord: {
            select: {
              id: true,
              name: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          currentTenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.housing.count({ where }),
    ]);

    return { data, meta: this.paginationMeta(total, page, limit) };
  }

  // ==================== USER AVAILABILITY (SOFT DELETE) ====================

  async setUserAvailability(
    userId: number,
    dto: SetUserAvailabilityDto,
    actor: AdminActor,
  ) {
    const actorNumericId = this.actorId(actor);

    if (!dto.isAvailable && actorNumericId === userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas désactiver votre propre compte',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isAvailable: dto.isAvailable },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isAvailable: true,
      },
    });

    await this.recordAudit(
      actor,
      AUDIT_ACTION.SET_USER_AVAILABILITY,
      AUDIT_ENTITY.USER,
      userId,
      {
        isAvailable: dto.isAvailable,
        role: user.role,
      },
    );

    return updated;
  }

  // ==================== AUDIT LOG ====================

  async listAuditLogs(query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.actorId != null && { actorId: query.actorId }),
      ...(search && {
        OR: [
          { action: { contains: search, mode: 'insensitive' } },
          { entityType: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return { data, meta: this.paginationMeta(total, page, limit) };
  }

  // ==================== STATISTICS ====================

  async getStats(): Promise<StatsResponseDto> {
    const [
      totalAdmins,
      totalLandlords,
      totalTenants,
      totalHousings,
      occupiedHousings,
      vacantHousings,
      ticketsOpen,
      ticketsResolved,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { role: 'BAILLEUR' } }),
      this.prisma.user.count({ where: { role: 'LOCATAIRE' } }),
      this.prisma.housing.count(),
      this.prisma.housing.count({
        where: { currentTenant: { isNot: null } },
      }),
      this.prisma.housing.count({
        where: { currentTenant: null },
      }),
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
      this.prisma.ticket.count({ where: { status: 'RESOLVED' } }),
    ]);

    return {
      totalAdmins,
      totalLandlords,
      totalTenants,
      totalHousings,
      occupiedHousings,
      vacantHousings,
      ticketsOpen,
      ticketsResolved,
    };
  }

  // ==================== DASHBOARD STATS ====================

  async getDashboardStats() {
    const stats = await this.getStats();
    const recentAdmins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentLandlords = await this.prisma.user.findMany({
      where: { role: 'BAILLEUR' },
      select: {
        id: true,
        email: true,
        phone: true,
        createdAt: true,
        landlord: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentTickets = await this.prisma.ticket.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        housing: { select: { address: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const occupancyRate =
      stats.totalHousings > 0
        ? Math.round((stats.occupiedHousings / stats.totalHousings) * 1000) / 10
        : 0;

    const last7Days: {
      date: string;
      newTickets: number;
      newUsers: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [newTickets, newUsers] = await Promise.all([
        this.prisma.ticket.count({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
        this.prisma.user.count({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
      ]);

      last7Days.push({
        date: dayStart.toISOString().slice(0, 10),
        newTickets,
        newUsers,
      });
    }

    return {
      stats,
      occupancyRate,
      trends: { last7Days },
      recentAdmins,
      recentLandlords,
      recentTickets,
    };
  }
}
