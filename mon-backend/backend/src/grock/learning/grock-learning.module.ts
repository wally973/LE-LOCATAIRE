import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GrockDecisionJournalService } from './grock-decision-journal.service';
import { GrockLearningService } from './grock-learning.service';
import { GrockLearningController } from './grock-learning.controller';

/**
 * Boucle d'apprentissage Grock — journal (étage 1), sondes (étage 2),
 * arbitrage (étage 3). Module admin, isolé du chemin locataire.
 */
@Module({
  imports: [PrismaModule],
  controllers: [GrockLearningController],
  providers: [GrockDecisionJournalService, GrockLearningService],
  exports: [GrockLearningService],
})
export class GrockLearningModule {}
