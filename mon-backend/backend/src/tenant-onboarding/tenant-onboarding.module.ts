import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { TenantOccupancyModule } from '../tenant-occupancy/tenant-occupancy.module';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { TenantOnboardingPublicController } from './tenant-onboarding-public.controller';
import { TenantOnboardingLandlordController } from './tenant-onboarding-landlord.controller';

@Module({
  imports: [AuthModule, FeatureFlagsModule, TenantOccupancyModule],
  controllers: [
    TenantOnboardingPublicController,
    TenantOnboardingLandlordController,
  ],
  providers: [TenantOnboardingService, PrismaService],
  exports: [TenantOnboardingService],
})
export class TenantOnboardingModule {}
