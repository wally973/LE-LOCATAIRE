import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CaseReferenceService } from './case-reference.service';
import { TicketsController } from './tickets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiPhotoService } from '../ai/ai-photo.service';
import { AuthModule } from '../auth/auth.module';
import { LiaModule } from '../lia/lia.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { TenantOccupancyModule } from '../tenant-occupancy/tenant-occupancy.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    NotificationsModule,
    FeatureFlagsModule,
    LiaModule,
    TenantOccupancyModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService, AiPhotoService, CaseReferenceService],
  exports: [TicketsService],
})
export class TicketsModule {}