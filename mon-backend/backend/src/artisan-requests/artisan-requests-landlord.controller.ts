import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BailleurScopeGuard } from '../auth/scope/bailleur-scope.guard';
import { BailleurScope } from '../auth/decorators/bailleur-scope.decorator';
import type { BailleurScope as BailleurScopeType } from '../auth/scope/bailleur-scope.types';
import { ArtisanRequestsService } from './artisan-requests.service';

/**
 * Vue bailleur (lecture seule) — un bailleur voit les demandes d'artisan
 * ouvertes par ses locataires (visibilité full validée P3).
 * Les agents peuvent également consulter (read-only) la même liste.
 */
@ApiTags('landlord-artisan-requests')
@ApiBearerAuth('bearer')
@Controller('landlords/me/artisan-requests')
@UseGuards(JwtAuthGuard, RolesGuard, BailleurScopeGuard)
export class ArtisanRequestsLandlordController {
  constructor(
    private readonly artisanRequests: ArtisanRequestsService,
  ) {}

  @Get()
  @Roles('BAILLEUR', 'AGENT', 'ADMIN')
  @ApiOperation({
    summary:
      'Lister les demandes d’artisan ouvertes par mes locataires (lecture seule)',
  })
  list(@BailleurScope() scope: BailleurScopeType) {
    return this.artisanRequests.listForLandlord(scope);
  }
}
