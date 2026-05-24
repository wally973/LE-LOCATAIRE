import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../auth/guard/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BailleurScopeGuard } from '../../auth/scope/bailleur-scope.guard';
import { BailleurScope } from '../../auth/decorators/bailleur-scope.decorator';
import type { BailleurScope as BailleurScopeType } from '../../auth/scope/bailleur-scope.types';
import { AgentsReclamationsService } from './agents-reclamations.service';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../../feature-flags/landlord-module.guard';

@ApiTags('agents')
@ApiBearerAuth('bearer')
@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard, BailleurScopeGuard, LandlordModuleGuard)
export class AgentsController {
  constructor(private readonly reclamations: AgentsReclamationsService) {}

  @Get('me/reclamations')
  @Roles('AGENT', 'BAILLEUR', 'ADMIN')
  @RequiresLandlordModule('ticketsModule')
  @ApiOperation({
    summary:
      'Liste des réclamations du secteur (référent AGENT) avec jours sans traitement (+N)',
  })
  listReclamations(
    @BailleurScope() scope: BailleurScopeType,
    @Query('onlyOpen') onlyOpen?: string,
  ) {
    if (!scope.landlordProfileId) {
      throw new ForbiddenException('Profil bailleur requis');
    }
    const open =
      onlyOpen === '1' || onlyOpen === 'true' || onlyOpen === undefined;
    return this.reclamations.listForScope(scope, open);
  }
}
