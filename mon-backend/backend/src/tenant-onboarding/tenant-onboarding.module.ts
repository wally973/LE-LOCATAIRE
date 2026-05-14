import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { TenantOnboardingPublicController } from './tenant-onboarding-public.controller';
import { TenantOnboardingLandlordController } from './tenant-onboarding-landlord.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    TenantOnboardingPublicController,
    TenantOnboardingLandlordController,
  ],
  providers: [TenantOnboardingService, PrismaService],
  exports: [TenantOnboardingService],
})
export class TenantOnboardingModule {}
