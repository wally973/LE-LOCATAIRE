import { Module } from '@nestjs/common';
import { AiTicketService } from './ai-ticket.service';
import { AiDispatchService } from './ai-dispatch.service';
import { AiQualityService } from './ai-quality.service';
import { AiLegalService } from './ai-legal.service';
import { AiInsuranceService } from './ai-insurance.service';
import { AiSupportService } from './ai-support.service';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [AiController],
  providers: [
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
