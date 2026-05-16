import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiPhotoService } from '../ai/ai-photo.service';
import { AuthModule } from '../auth/auth.module';
import { LiaModule } from '../lia/lia.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    NotificationsModule,
    FeatureFlagsModule,
    LiaModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService, AiPhotoService],
  exports: [TicketsService],
})
export class TicketsModule {}