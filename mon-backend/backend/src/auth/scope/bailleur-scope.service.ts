import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { BailleurScope } from './bailleur-scope.types';

interface JwtUserLike {
  userId?: number;
  id?: number;
  role?: string;
}

/**
 * Résout la portée multi-tenant d'un utilisateur authentifié à partir de son JWT.
 *
 * Stratégie volontairement simple en V1 :
 * - 1 requête Prisma par appel (peut être mise en cache plus tard si nécessaire).
 * - Pas d'enrichissement du JWT (évite la complexité de re-sign / refresh).
 */
@Injectable()
export class BailleurScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(jwtUser: JwtUserLike): Promise<BailleurScope> {
    const userId = jwtUser.userId ?? jwtUser.id;
    const role = jwtUser.role;

    if (!userId || !role) {
      throw new UnauthorizedException('Utilisateur JWT incomplet');
    }

    const base: BailleurScope = {
      isAdmin: role === 'ADMIN',
      role,
      userId,
    };

    if (role === 'ADMIN') {
      return base;
    }

    if (role === 'BAILLEUR') {
      const landlord = await this.prisma.landlordProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!landlord) {
        throw new UnauthorizedException(
          'Aucun profil bailleur rattaché à ce compte',
        );
      }
      return { ...base, landlordProfileId: landlord.id };
    }

    if (role === 'AGENT') {
      const agent = await this.prisma.agentProfile.findUnique({
        where: { userId },
        select: { landlordProfileId: true, agenceId: true },
      });
      if (!agent) {
        throw new UnauthorizedException(
          'Aucun profil agent rattaché à ce compte',
        );
      }
      return {
        ...base,
        landlordProfileId: agent.landlordProfileId,
        agenceId: agent.agenceId,
      };
    }

    if (role === 'LOCATAIRE') {
      const tenant = await this.prisma.tenantProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      return {
        ...base,
        tenantProfileId: tenant?.id,
      };
    }

    // PRESTATAIRE ou autre rôle : aucune portée bailleur, à enrichir au besoin.
    return base;
  }
}
