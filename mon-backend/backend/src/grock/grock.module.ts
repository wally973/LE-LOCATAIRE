import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { LiaHostService } from '../agents/orchestrateur/conversation/lia-host.service';
import { GrockService } from './grock.service';
import { LLM_OPERATOR } from './port/llm-operator.port';
import { MistralOperator } from './port/mistral.operator';
import { DOMAIN_PACK } from './domain/domain-pack.port';
import { SocialHousingGuyanePack } from './domain/social-housing-guyane.pack';
import { GrockDecisionJournalService } from './learning/grock-decision-journal.service';
import { GrockPreprocessorService } from './preprocessor/grock-preprocessor.service';
import { GrockBailleurService } from './surface/grock-bailleur.service';
import { GrockBailleurController } from './surface/grock-bailleur.controller';

@Module({
  imports: [PrismaModule, FeatureFlagsModule],
  controllers: [GrockBailleurController],
  providers: [
    LiaHostService,
    MistralOperator,
    { provide: LLM_OPERATOR, useExisting: MistralOperator },
    SocialHousingGuyanePack,
    { provide: DOMAIN_PACK, useExisting: SocialHousingGuyanePack },
    GrockPreprocessorService,
    GrockDecisionJournalService,
    GrockService,
    GrockBailleurService,
  ],
  exports: [GrockService, LiaHostService, GrockBailleurService],
})
export class GrockModule {}
