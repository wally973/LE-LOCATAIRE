import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DiagnosticContextService } from './diagnostic-context.service';

/** Socle partagé — capteurs, DiagnosticState, contexte ticket. */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [DiagnosticContextService],
  exports: [DiagnosticContextService],
})
export class AgentsSharedModule {}
