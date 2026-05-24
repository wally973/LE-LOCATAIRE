import { Module } from '@nestjs/common';
import { AgentsSharedModule } from './shared/agents-shared.module';
import { ReferentAgentsModule } from './referent/referent-agents.module';
import { LiaModule } from './orchestrateur/lia-ecosystem.module';

/** Module racine agents : référents terrain + écosystème IA Lia. */
@Module({
  imports: [AgentsSharedModule, ReferentAgentsModule, LiaModule],
  exports: [AgentsSharedModule, ReferentAgentsModule, LiaModule],
})
export class AgentsModule {}
