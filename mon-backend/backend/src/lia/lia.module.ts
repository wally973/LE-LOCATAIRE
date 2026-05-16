import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiRoutingModule } from '../ai-routing/ai-routing.module';
import { ArtisanRequestsModule } from '../artisan-requests/artisan-requests.module';
import { LiaHostService } from './lia-host.service';
import { LiaConversationService } from './lia-conversation.service';
import { LiaOrchestratorService } from './lia-orchestrator.service';

/** Sprint F — conversation Lia (hôte + orchestration async). */
@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AiRoutingModule,
    ArtisanRequestsModule,
  ],
  providers: [LiaHostService, LiaConversationService, LiaOrchestratorService],
  exports: [LiaOrchestratorService, LiaConversationService],
})
export class LiaModule {}
