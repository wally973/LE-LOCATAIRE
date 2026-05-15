import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFeatureFlagsDto } from './dto/update-feature-flags.dto';
import type { LandlordModuleKey } from './feature-flags.types';

const DEFAULT_FLAGS = {
  ticketsModule: true,
  tenantOnboardingModule: true,
  aiRoutingModule: true,
  videoLibraryModule: true,
  artisanRequestsModule: true,
  socialModule: true,
  hlmModule: false,
  contratsModule: true,
  paiementsModule: true,
} as const;

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateForLandlordProfile(landlordProfileId: number) {
    return this.prisma.landlordFeatureFlags.upsert({
      where: { landlordProfileId },
      create: { landlordProfileId, ...DEFAULT_FLAGS },
      update: {},
    });
  }

  async getByLandlordUserId(userId: number) {
    const profile = await this.prisma.landlordProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Profil bailleur introuvable');
    }
    return this.getOrCreateForLandlordProfile(profile.id);
  }

  async getByLandlordUserIdOrNull(userId: number) {
    const profile = await this.prisma.landlordProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return null;
    return this.getOrCreateForLandlordProfile(profile.id);
  }

  async updateForLandlordProfile(
    landlordProfileId: number,
    dto: UpdateFeatureFlagsDto,
  ) {
    await this.ensureLandlordProfileExists(landlordProfileId);
    await this.getOrCreateForLandlordProfile(landlordProfileId);
    return this.prisma.landlordFeatureFlags.update({
      where: { landlordProfileId },
      data: dto,
    });
  }

  async assertModuleEnabled(
    landlordProfileId: number,
    moduleKey: LandlordModuleKey,
  ) {
    const flags = await this.getOrCreateForLandlordProfile(landlordProfileId);
    if (!flags[moduleKey]) {
      throw new ForbiddenException(
        `Le module « ${moduleKey} » n'est pas activé pour ce bailleur`,
      );
    }
  }

  /** Résout le landlordProfileId depuis l'id utilisateur bailleur. */
  async assertModuleEnabledForUser(
    landlordUserId: number,
    moduleKey: LandlordModuleKey,
  ) {
    const profile = await this.prisma.landlordProfile.findUnique({
      where: { userId: landlordUserId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Profil bailleur introuvable');
    }
    await this.assertModuleEnabled(profile.id, moduleKey);
  }

  private async ensureLandlordProfileExists(landlordProfileId: number) {
    const exists = await this.prisma.landlordProfile.findUnique({
      where: { id: landlordProfileId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Bailleur introuvable');
    }
  }
}
