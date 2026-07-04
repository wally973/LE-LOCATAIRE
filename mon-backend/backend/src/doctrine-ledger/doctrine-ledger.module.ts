import { Module } from '@nestjs/common';
import { LivingCyberGardienService } from '../agents/orchestrateur/living-intelligence/living-cyber-gardien.service';
import { DoctrineLedgerController } from './doctrine-ledger.controller';
import { DoctrineLedgerService } from './doctrine-ledger.service';

@Module({
  controllers: [DoctrineLedgerController],
  providers: [DoctrineLedgerService, LivingCyberGardienService],
  exports: [DoctrineLedgerService],
})
export class DoctrineLedgerModule {}
