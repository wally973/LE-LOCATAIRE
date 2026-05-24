import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentsController } from './agents.controller';
import { AgentsReclamationsService } from './agents-reclamations.service';

/** Référents humains (dashboard) — distinct de l’écosystème IA Lia. */
@Module({
  imports: [AuthModule, FeatureFlagsModule],
  controllers: [AgentsController],
  providers: [AgentsReclamationsService, PrismaService],
  exports: [AgentsReclamationsService],
})
export class ReferentAgentsModule {}
