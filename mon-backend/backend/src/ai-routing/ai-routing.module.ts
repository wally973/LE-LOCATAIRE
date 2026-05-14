import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthModule } from '../auth/auth.module';
import { AiDiagnosticsModule } from '../ai-diagnostics/ai-diagnostics.module';
import { AI_PIPELINE } from './ai-pipeline.port';
import { AiPipelineStubAdapter } from './ai-pipeline-stub.adapter';
import { AiRoutingService } from './ai-routing.service';
import { AiRoutingController } from './ai-routing.controller';

/**
 * Module Sprint 3 — routage automatique IA des tickets.
 *
 * Sprint 7 : remplacer AiPipelineStubAdapter par OpenAiPipelineAdapter
 * (ou un compose multi-adapter) sans toucher au reste du code.
 */
@Module({
  imports: [AuthModule, AiDiagnosticsModule],
  controllers: [AiRoutingController],
  providers: [
    PrismaService,
    NotificationsService,
    AiRoutingService,
    AiPipelineStubAdapter,
    {
      provide: AI_PIPELINE,
      useExisting: AiPipelineStubAdapter,
    },
  ],
  exports: [AiRoutingService, AI_PIPELINE],
})
export class AiRoutingModule {}
