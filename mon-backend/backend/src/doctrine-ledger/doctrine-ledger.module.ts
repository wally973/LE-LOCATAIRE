import { Module } from '@nestjs/common';
import { DoctrineLedgerController } from './doctrine-ledger.controller';
import { DoctrineLedgerService } from './doctrine-ledger.service';

@Module({
  controllers: [DoctrineLedgerController],
  providers: [DoctrineLedgerService],
  exports: [DoctrineLedgerService],
})
export class DoctrineLedgerModule {}
