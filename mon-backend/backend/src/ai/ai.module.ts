import { Module } from '@nestjs/common';
import { AiTicketService } from './ai-ticket.service';
import { AiDispatchService } from './ai-dispatch.service';
import { AiQualityService } from './ai-quality.service';
import { AiLegalService } from './ai-legal.service';
import { AiInsuranceService } from './ai-insurance.service';
import { AiSupportService } from './ai-support.service';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [
    PrismaService,
    NotificationsService,
    AiService,
    AiTicketService,
    AiDispatchService,
    AiQualityService,
    AiLegalService,
    AiInsuranceService,
    AiSupportService,
  ],
  exports: [
    AiTicketService,
    AiDispatchService,
    AiQualityService,
    AiLegalService,
    AiInsuranceService,
    AiSupportService,
  ],
})
export class AiModule {}
