import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiPhotoService } from '../ai/ai-photo.service';
import { AuthModule } from '../auth/auth.module';
import { AiRoutingModule } from '../ai-routing/ai-routing.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule, AiRoutingModule],
  controllers: [TicketsController],
  providers: [TicketsService, AiPhotoService],
  exports: [TicketsService],
})
export class TicketsModule {}