import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { MaintenanceContractMapperService } from './maintenance-contract-mapper.service';
import { MaintenanceContractsController } from './maintenance-contracts.controller';

/** Marchés d'entretien — mapping hypothèse diagnostic → contrat public (PDF + BPU). */
@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceContractsController],
  providers: [MaintenanceContractMapperService],
  exports: [MaintenanceContractMapperService],
})
export class MaintenanceMarchesModule {}
