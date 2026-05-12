import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiDiagnosticsService } from './ai-diagnostics.service';
import { AiDiagnosticsController } from './ai-diagnostics.controller';
import { AdminAiDiagnosticsController } from './admin-ai-diagnostics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AiDiagnosticsController, AdminAiDiagnosticsController],
  providers: [AiDiagnosticsService],
  exports: [AiDiagnosticsService],
})
export class AiDiagnosticsModule {}
