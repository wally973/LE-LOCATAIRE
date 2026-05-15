import { Module } from '@nestjs/common';
import { PaiementsController } from './paiements.controller';
import { PaiementsService } from './paiements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [AuthModule, FeatureFlagsModule],
  controllers: [PaiementsController],
  providers: [PaiementsService, PrismaService],
  exports: [PaiementsService],
})
export class PaiementsModule {}
