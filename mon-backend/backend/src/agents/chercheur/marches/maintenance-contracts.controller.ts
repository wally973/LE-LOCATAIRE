import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guard/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { MaintenanceContractMapperService } from './maintenance-contract-mapper.service';
import { isUrgentCriticalSeverity } from '../../shared/critical-safety-protocol';

/** Marchés d'entretien — lien diagnostic → prestataire sous contrat. */
@ApiTags('maintenance-contracts')
@ApiBearerAuth('bearer')
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceContractsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: MaintenanceContractMapperService,
  ) {}

  @Get(':id/maintenance-contract')
  @Roles('BAILLEUR', 'AGENT', 'ADMIN', 'PRESTATAIRE')
  @ApiOperation({
    summary: 'Mapper leadingHypothesisId → ContractID (marché public / BPU)',
  })
  async matchContract(@Param('id', ParseIntPipe) ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');

    const urgent = isUrgentCriticalSeverity(ticket.aiSeverity ?? '');
    const match = this.mapper.resolveForTicketAiDecision(ticket.aiLastDecision, {
      category: ticket.aiCategory ?? undefined,
      contextText: `${ticket.title} ${ticket.description}`,
      urgent,
    });

    if (!match) {
      return {
        ticketId,
        mapped: false,
        message:
          'Aucun contrat de marché associé à l’hypothèse diagnostic actuelle.',
      };
    }

    return {
      ticketId,
      mapped: true,
      leadingHypothesisId: match.leadingHypothesisId,
      contractId: match.contractId,
      lot: match.contract.lot,
      supplier: match.contract.supplier,
      label: match.contract.label,
      kpi: match.contract.kpi,
      bpuSamples: match.contract.bpuSamples,
      sourceDocuments: match.contract.sourceDocuments,
      urgent: match.urgent,
      brief: this.mapper.formatBrief(match),
    };
  }
}
