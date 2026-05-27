import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { AiRoutingModule } from '../../ai-routing/ai-routing.module';
import { ArtisanRequestsModule } from '../../artisan-requests/artisan-requests.module';
import { AuthModule } from '../../auth/auth.module';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';
import { LegalReferencesModule } from '../../legal-references/legal-references.module';
import { AgentsSharedModule } from '../shared/agents-shared.module';
import { LiaHostService } from './conversation/lia-host.service';
import { LiaConversationService } from './conversation/lia-conversation.service';
import { LiaOrchestratorService } from './conversation/lia-orchestrator.service';
import { LiaCompanionService } from './conversation/lia-companion.service';
import { LiaSharedStateService } from './conversation/lia-shared-state.service';
import { LiaComprehensionService } from './conversation/lia-comprehension.service';
import { LiaAgentService } from './conversation/lia-agent.service';
import { LiaIntakeService } from './intake/lia-intake.service';
import { LiaIntakeReactiveService } from './intake/lia-intake-reactive.service';
import { LiaExpertPocketService } from './conversation/lia-expert-pocket.service';
import { LiaJarvisPilotService } from './intake/lia-jarvis-pilot.service';
import { LiaJarvisHandoffService } from './intake/lia-jarvis-handoff.service';
import { LiaResearchService } from '../chercheur/research/lia-research.service';
import { LiaHousingWarrantyService } from '../chercheur/research/lia-housing-warranty';
import { LiaDiagnosticCapabilityService } from '../diagnostiqueur/capability/lia-diagnostic-capability.service';
import { LiaProBriefingService } from '../diagnostiqueur/briefing/lia-pro-briefing.service';
import { LiaExpertRectificationService } from '../diagnostiqueur/briefing/lia-expert-rectification.service';
import { MaintenanceMarchesModule } from '../chercheur/marches/maintenance-marches.module';

/** Écosystème Lia — Agent Jarvis (visualisation systémique + escalade humaine). */
@Module({
  imports: [
    AgentsSharedModule,
    PrismaModule,
    NotificationsModule,
    AuthModule,
    forwardRef(() => AiRoutingModule),
    ArtisanRequestsModule,
    FeatureFlagsModule,
    LegalReferencesModule,
    MaintenanceMarchesModule,
  ],
  providers: [
    LiaHostService,
    LiaConversationService,
    LiaIntakeService,
    LiaResearchService,
    LiaHousingWarrantyService,
    LiaCompanionService,
    LiaSharedStateService,
    LiaComprehensionService,
    LiaDiagnosticCapabilityService,
    LiaAgentService,
    LiaProBriefingService,
    LiaExpertRectificationService,
    LiaIntakeReactiveService,
    LiaExpertPocketService,
    LiaJarvisPilotService,
    LiaJarvisHandoffService,
    LiaOrchestratorService,
  ],
  exports: [
    LiaOrchestratorService,
    LiaConversationService,
    LiaIntakeService,
    LiaProBriefingService,
    LiaExpertRectificationService,
    LiaSharedStateService,
    LiaCompanionService,
    MaintenanceMarchesModule,
  ],
})
export class LiaModule {}
