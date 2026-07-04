import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { AiDiagnosticsModule } from '../ai-diagnostics/ai-diagnostics.module';
import { VideoLibraryModule } from '../video-library/video-library.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { LegalReferencesModule } from '../legal-references/legal-references.module';
import { LiaModule } from '../lia/lia.module';
import { AgentsSharedModule } from '../agents/shared/agents-shared.module';
import { AI_PIPELINE } from './ai-pipeline.port';
import { AiPipelineStubAdapter } from './ai-pipeline-stub.adapter';
import { AiPipelineLiaAdapter } from './ai-pipeline-lia.adapter';
import { AiMemoryService } from './ai-memory.service';
import { LiaPathologistService } from './agents/lia-pathologist.service';
import { LiaJuristService } from './agents/lia-jurist.service';
import { AiRoutingService } from './ai-routing.service';
import { AiRoutingController } from './ai-routing.controller';
import { AiSummarizerService } from '../ai/ai-summarizer.service';
import { GrockModule } from '../grock/grock.module';

function resolvePipelineMode(): 'stub' | 'lia' {
  const mode = (process.env.AI_PIPELINE_MODE ?? 'lia').toLowerCase();
  if (mode === 'stub') return 'stub';
  if (mode === 'lia') return 'lia';
  // auto : Lia si au moins une clé LLM, sinon stub
  if (mode === 'auto') {
    if (process.env.GEMINI_API_KEY || process.env.MISTRAL_API_KEY) return 'lia';
    return 'stub';
  }
  return 'lia';
}

/**
 * Module Sprint 3+ — routage IA des tickets.
 * Sprint G : pipeline Lia (pathologiste + juriste) sélectionnable via AI_PIPELINE_MODE.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    NotificationsModule,
    AiDiagnosticsModule,
    VideoLibraryModule,
    FeatureFlagsModule,
    LegalReferencesModule,
    GrockModule,
    forwardRef(() => LiaModule),
    AgentsSharedModule,
  ],
  controllers: [AiRoutingController],
  providers: [
    AiRoutingService,
    AiMemoryService,
    LiaPathologistService,
    LiaJuristService,
    AiPipelineStubAdapter,
    AiPipelineLiaAdapter,
    AiSummarizerService,
    {
      provide: AI_PIPELINE,
      useFactory: (
        lia: AiPipelineLiaAdapter,
        stub: AiPipelineStubAdapter,
      ) => (resolvePipelineMode() === 'lia' ? lia : stub),
      inject: [AiPipelineLiaAdapter, AiPipelineStubAdapter],
    },
  ],
  exports: [
    AiRoutingService,
    AI_PIPELINE,
    LiaPathologistService,
    AiSummarizerService,
  ],
})
export class AiRoutingModule {}
