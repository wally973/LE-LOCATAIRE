import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiTicketService } from '../ai/ai-ticket.service';
import { AiDispatchService } from '../ai/ai-dispatch.service';
import { AiService } from '../ai/ai.service';
import { AiSocialService } from '../ai/ai-social.service';
import { AiPhotoService } from '../ai/ai-photo.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    PrismaService,
    NotificationsService,
    AiTicketService,
    AiDispatchService,
    AiService,
    AiSocialService,
    AiPhotoService,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}