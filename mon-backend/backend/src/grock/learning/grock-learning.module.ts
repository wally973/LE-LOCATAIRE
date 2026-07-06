import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GrockModule } from '../grock.module';
import { GrockDecisionJournalService } from './grock-decision-journal.service';
import { GrockLearningService } from './grock-learning.service';
import { GrockLearningController } from './grock-learning.controller';

/**
 * Boucle d'apprentissage Grock — journal (étage 1), sondes (étage 2),
 * arbitrage (étage 3), dialogue admin (même moteur). Module admin.
 */
@Module({
  imports: [PrismaModule, GrockModule],
  controllers: [GrockLearningController],
  providers: [GrockDecisionJournalService, GrockLearningService],
  exports: [GrockLearningService],
})
export class GrockLearningModule {}
