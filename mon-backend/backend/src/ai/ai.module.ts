import { Module } from '@nestjs/common';
import { AiTicketService } from './ai-ticket.service';
import { AiDispatchService } from './ai-dispatch.service';
import { AiQualityService } from './ai-quality.service';
import { AiLegalService } from './ai-legal.service';
import { AiInsuranceService } from './ai-insurance.service';
import { AiSupportService } from './ai-support.service';
import { AiSocialService } from './ai-social.service';
import { AiService } from './ai.service';
import { AiPhotoService } from './ai-photo.service';
import { AiController } from './ai.controller';
import { AiRoutingModule } from '../ai-routing/ai-routing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { AgentsSharedModule } from '../agents/shared/agents-shared.module';
import { LegalReferencesModule } from '../legal-references/legal-references.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    NotificationsModule,
    AgentsSharedModule,
    LegalReferencesModule,
    AiRoutingModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    AiPhotoService,
    AiTicketService,
    AiDispatchService,
    AiQualityService,
    AiLegalService,
    AiInsuranceService,
    AiSupportService,
    AiSocialService,
  ],
  exports: [
    AiTicketService,
    AiDispatchService,
    AiQualityService,
    AiLegalService,
    AiInsuranceService,
    AiSupportService,
    AiSocialService,
    AiRoutingModule,
  ],
})
export class AiModule {}
