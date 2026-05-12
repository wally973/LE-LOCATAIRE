import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HlmEntretienController } from './entretien/hlm-entretien.controller';
import { HlmEntretienService } from './entretien/hlm-entretien.service';
import { HlmIAController } from './ia/hlm-ia.controller';
import { HlmIAService } from './ia/hlm-ia.service';
import { HlmLogementController } from './logement/hlm-logement.controller';
import { HlmLogementService } from './logement/hlm-logement.service';
import { HlmPreuveController } from './preuves/hlm-preuve.controller';
import { HlmPreuveService } from './preuves/hlm-preuve.service';
import { HlmResidenceController } from './residence/hlm-residence.controller';
import { HlmResidenceService } from './residence/hlm-residence.service';
import { HlmTicketController } from './tickets/hlm-ticket.controller';
import { HlmTicketService } from './tickets/hlm-ticket.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    HlmResidenceController,
    HlmLogementController,
    HlmEntretienController,
    HlmPreuveController,
    HlmTicketController,
    HlmIAController,
  ],
  providers: [
    HlmResidenceService,
    HlmLogementService,
    HlmEntretienService,
    HlmPreuveService,
    HlmTicketService,
    HlmIAService,
  ],
  exports: [
    HlmResidenceService,
    HlmLogementService,
    HlmEntretienService,
    HlmPreuveService,
    HlmTicketService,
    HlmIAService,
  ],
})
export class HlmModule {}
