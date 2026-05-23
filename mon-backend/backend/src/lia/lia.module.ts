import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiRoutingModule } from '../ai-routing/ai-routing.module';
import { ArtisanRequestsModule } from '../artisan-requests/artisan-requests.module';
import { AuthModule } from '../auth/auth.module';
import { LiaHostService } from './lia-host.service';
import { LiaConversationService } from './lia-conversation.service';
import { LiaOrchestratorService } from './lia-orchestrator.service';
import { LiaIntakeService } from './lia-intake.service';
import { LiaResearchService } from './lia-research.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { LegalReferencesModule } from '../legal-references/legal-references.module';
import { LiaCompanionService } from './lia-companion.service';
import { LiaSharedStateService } from './lia-shared-state.service';
import { LiaComprehensionService } from './lia-comprehension.service';
import { LiaDiagnosticCapabilityService } from './lia-diagnostic-capability.service';
import { LiaAgentService } from './lia-agent.service';
import { LiaProBriefingService } from './lia-pro-briefing.service';
import { LiaExpertRectificationService } from './lia-expert-rectification.service';

/** Sprint F — conversation Lia (hôte + agent réactif par objectifs). */
@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuthModule,
    forwardRef(() => AiRoutingModule),
    ArtisanRequestsModule,
    FeatureFlagsModule,
    LegalReferencesModule,
  ],
  providers: [
    LiaHostService,
    LiaConversationService,
    LiaIntakeService,
    LiaResearchService,
    LiaCompanionService,
    LiaSharedStateService,
    LiaComprehensionService,
    LiaDiagnosticCapabilityService,
    LiaAgentService,
    LiaProBriefingService,
    LiaExpertRectificationService,
    LiaOrchestratorService,
  ],
  exports: [
    LiaOrchestratorService,
    LiaConversationService,
    LiaIntakeService,
    LiaProBriefingService,
    LiaExpertRectificationService,
  ],
})
export class LiaModule {}
