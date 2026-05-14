import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiPhotoService } from '../ai/ai-photo.service';
import { AuthModule } from '../auth/auth.module';
import { AiRoutingModule } from '../ai-routing/ai-routing.module';

@Module({
  imports: [AuthModule, AiRoutingModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    PrismaService,
    NotificationsService,
    AiPhotoService,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}