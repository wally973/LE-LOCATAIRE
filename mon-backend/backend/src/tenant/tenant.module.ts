import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiDiagnosticsModule } from '../ai-diagnostics/ai-diagnostics.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
@Module({
  imports: [PrismaModule, AiDiagnosticsModule, FeatureFlagsModule],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
