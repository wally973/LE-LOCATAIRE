import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaiementsService } from './paiements.service';
import { CreatePaiementDto } from './dto/create-paiement.dto';
import { UpdatePaiementDto } from './dto/update-paiement.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BailleurScopeGuard } from '../auth/scope/bailleur-scope.guard';
import { BailleurScope } from '../auth/decorators/bailleur-scope.decorator';
import type { BailleurScope as BailleurScopeType } from '../auth/scope/bailleur-scope.types';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../feature-flags/landlord-module.guard';

@ApiTags('paiements')
@ApiBearerAuth('bearer')
@Controller('paiements')
@UseGuards(JwtAuthGuard, RolesGuard, BailleurScopeGuard, LandlordModuleGuard)
@RequiresLandlordModule('paiementsModule')
export class PaiementsController {
  constructor(private readonly paiementsService: PaiementsService) {}

  @Post()
  @Roles('ADMIN', 'BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Enregistrer un paiement' })
  @ApiResponse({ status: 201, description: 'Paiement créé' })
  @ApiResponse({ status: 400, description: 'Contrat invalide' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Droits insuffisants' })
  @ApiResponse({ status: 409, description: 'Référence déjà utilisée' })
  create(@Body() dto: CreatePaiementDto) {
    // Note : la cohérence avec le périmètre bailleur est vérifiée côté service
    // via la relation contrat.landlordProfileId (Prisma P2003 si invalide).
    return this.paiementsService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Lister les paiements (filtrés par bailleur via JWT)' })
  @ApiResponse({ status: 200, description: 'Liste récupérée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  findAll(@BailleurScope() scope: BailleurScopeType) {
    return this.paiementsService.findAll(scope);
  }

  @Get(':id')
  @Roles('ADMIN', 'BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Détail d’un paiement' })
  @ApiResponse({ status: 200, description: 'Paiement trouvé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Introuvable' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @BailleurScope() scope: BailleurScopeType,
  ) {
    return this.paiementsService.findOne(id, scope);
  }

  @Patch(':id')
  @Roles('ADMIN', 'BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Mettre à jour un paiement' })
  @ApiResponse({ status: 200, description: 'Mis à jour' })
  @ApiResponse({ status: 400, description: 'Contrat invalide' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Introuvable' })
  @ApiResponse({ status: 409, description: 'Référence déjà utilisée' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaiementDto,
    @BailleurScope() scope: BailleurScopeType,
  ) {
    return this.paiementsService.update(id, dto, scope);
  }

  @Delete(':id')
  @Roles('ADMIN', 'BAILLEUR')
  @ApiOperation({ summary: 'Supprimer un paiement' })
  @ApiResponse({ status: 200, description: 'Supprimé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Introuvable' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @BailleurScope() scope: BailleurScopeType,
  ) {
    return this.paiementsService.remove(id, scope);
  }
}
