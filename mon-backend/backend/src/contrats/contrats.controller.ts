import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { ContratsService } from './contrats.service';
import { CreateContratDto } from './dto/create-contrat.dto';
import { UpdateContratDto } from './dto/update-contrat.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BailleurScopeGuard } from '../auth/scope/bailleur-scope.guard';
import { BailleurScope } from '../auth/decorators/bailleur-scope.decorator';
import type { BailleurScope as BailleurScopeType } from '../auth/scope/bailleur-scope.types';

@ApiTags('contrats')
@ApiBearerAuth('bearer')
@Controller('contrats')
@UseGuards(JwtAuthGuard, RolesGuard, BailleurScopeGuard)
export class ContratsController {
  constructor(private readonly contratsService: ContratsService) {}

  @Post()
  @Roles('ADMIN', 'BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Créer un contrat de location' })
  @ApiResponse({ status: 201, description: 'Contrat créé' })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou références inexistantes',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Droits insuffisants' })
  create(
    @Body() dto: CreateContratDto,
    @BailleurScope() scope: BailleurScopeType,
  ) {
    // Un bailleur / agent ne peut créer un contrat que pour SON propre périmètre.
    if (!scope.isAdmin && scope.landlordProfileId !== dto.landlordProfileId) {
      throw new ForbiddenException(
        'Vous ne pouvez créer un contrat que pour votre propre périmètre',
      );
    }
    return this.contratsService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Lister les contrats (filtrés par bailleur via JWT)' })
  @ApiResponse({ status: 200, description: 'Liste récupérée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  findAll(@BailleurScope() scope: BailleurScopeType) {
    return this.contratsService.findAll(scope);
  }

  @Get(':id')
  @Roles('ADMIN', 'BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Détail d’un contrat' })
  @ApiResponse({ status: 200, description: 'Contrat trouvé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Introuvable' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @BailleurScope() scope: BailleurScopeType,
  ) {
    return this.contratsService.findOne(id, scope);
  }

  @Patch(':id')
  @Roles('ADMIN', 'BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Mettre à jour un contrat' })
  @ApiResponse({ status: 200, description: 'Mis à jour' })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou références inexistantes',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Introuvable' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContratDto,
    @BailleurScope() scope: BailleurScopeType,
  ) {
    if (
      !scope.isAdmin &&
      dto.landlordProfileId !== undefined &&
      dto.landlordProfileId !== scope.landlordProfileId
    ) {
      throw new ForbiddenException(
        'Impossible de transférer un contrat à un autre bailleur',
      );
    }
    return this.contratsService.update(id, dto, scope);
  }

  @Delete(':id')
  @Roles('ADMIN', 'BAILLEUR')
  @ApiOperation({ summary: 'Supprimer un contrat' })
  @ApiResponse({ status: 200, description: 'Supprimé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Introuvable' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @BailleurScope() scope: BailleurScopeType,
  ) {
    return this.contratsService.remove(id, scope);
  }
}
