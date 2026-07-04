import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LiaHostService } from '../agents/orchestrateur/conversation/lia-host.service';
import { GrockService } from './grock.service';
import { LLM_OPERATOR } from './port/llm-operator.port';
import { MistralOperator } from './port/mistral.operator';
import { DOMAIN_PACK } from './domain/domain-pack.port';
import { SocialHousingGuyanePack } from './domain/social-housing-guyane.pack';
import { GrockDecisionJournalService } from './learning/grock-decision-journal.service';

@Module({
  imports: [PrismaModule],
  providers: [
    LiaHostService,
    // PORT IA (Couche 1) : l'opérateur concret est branché ici, le noyau Grock
    // ne dépend que de l'interface LLM_OPERATOR.
    MistralOperator,
    { provide: LLM_OPERATOR, useExisting: MistralOperator },
    // PACK MÉTIER (Couche 3) : le savoir logement social est branché ici, le
    // noyau Grock ne dépend que de l'interface DOMAIN_PACK.
    SocialHousingGuyanePack,
    { provide: DOMAIN_PACK, useExisting: SocialHousingGuyanePack },
    // Boucle d'apprentissage — étage 1 : journal de décision (écriture seule).
    GrockDecisionJournalService,
    GrockService,
  ],
  exports: [GrockService, LiaHostService],
})
export class GrockModule {}
