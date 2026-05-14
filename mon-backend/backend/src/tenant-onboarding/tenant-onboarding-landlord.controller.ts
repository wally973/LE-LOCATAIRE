import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantRequestStatus } from '@prisma/client';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { ApproveTenantRequestDto } from './dto/approve-tenant-request.dto';
import { RejectTenantRequestDto } from './dto/reject-tenant-request.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BailleurScopeGuard } from '../auth/scope/bailleur-scope.guard';
import { BailleurScope } from '../auth/decorators/bailleur-scope.decorator';
import type { BailleurScope as BailleurScopeType } from '../auth/scope/bailleur-scope.types';

/**
 * Endpoints réservés au bailleur (et à ses agents) pour traiter les demandes
 * d'inscription en attente — lister, voir, approuver (crée TenantProfile +
 * Housing), refuser (avec motif).
 *
 * Les routes sont automatiquement scopées au bailleur via `BailleurScopeGuard` :
 * un bailleur ne voit que SES demandes, un agent ne voit que celles du bailleur
 * dont il dépend.
 */
@ApiTags('tenant-onboarding')
@ApiBearerAuth('bearer')
@Controller('landlords/me/tenant-requests')
@UseGuards(JwtAuthGuard, RolesGuard, BailleurScopeGuard)
@Roles('BAILLEUR', 'AGENT')
export class TenantOnboardingLandlordController {
  constructor(private readonly service: TenantOnboardingService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les demandes d’inscription locataire (filtre par status)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TenantRequestStatus,
    description: 'PENDING, APPROVED ou REJECTED — défaut : toutes',
  })
  @ApiResponse({ status: 200, description: 'Demandes triées par date décroissante' })
  list(
    @BailleurScope() scope: BailleurScopeType,
    @Query('status') status?: TenantRequestStatus,
  ) {
    this.ensureScope(scope);
    return this.service.listForLandlord(scope.landlordProfileId!, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une demande d’inscription locataire' })
  @ApiResponse({ status: 200, description: 'Demande trouvée' })
  @ApiResponse({ status: 404, description: 'Introuvable ou hors périmètre' })
  getOne(
    @Param('id', ParseIntPipe) id: number,
    @BailleurScope() scope: BailleurScopeType,
  ) {
    this.ensureScope(scope);
    return this.service.getOneForLandlord(scope.landlordProfileId!, id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary:
      'Approuver une demande : crée TenantProfile et Housing si nécessaire, active le compte',
  })
  @ApiResponse({ status: 201, description: 'Demande approuvée, locataire actif' })
  @ApiResponse({ status: 400, description: 'Logement invalide ou hors périmètre' })
  @ApiResponse({ status: 409, description: 'Logement déjà occupé' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveTenantRequestDto,
    @BailleurScope() scope: BailleurScopeType,
  ) {
    this.ensureScope(scope);
    return this.service.approve(scope.landlordProfileId!, id, dto);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Refuser une demande (motif obligatoire)' })
  @ApiResponse({ status: 201, description: 'Demande refusée' })
  @ApiResponse({ status: 400, description: 'Demande déjà traitée' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectTenantRequestDto,
    @BailleurScope() scope: BailleurScopeType,
  ) {
    this.ensureScope(scope);
    return this.service.reject(scope.landlordProfileId!, id, dto);
  }

  private ensureScope(scope: BailleurScopeType) {
    if (!scope.landlordProfileId) {
      throw new BadRequestException(
        'Aucun bailleur rattaché à ce compte — opération impossible',
      );
    }
  }
}
