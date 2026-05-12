import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HousingService } from './housing.service';
import { CreateHousingDto } from './dto/create-housing.dto';
import { UpdateHousingDto } from './dto/update-housing.dto';
import { AssignTenantDto } from './dto/assign-tenant.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('housing')
@ApiBearerAuth('bearer')
@Controller('housing')
export class HousingController {
  constructor(private readonly housingService: HousingService) {}

  // CRÉATION D’UN LOGEMENT (LANDLORD ou ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BAILLEUR', 'ADMIN')
  @ApiOperation({ summary: 'Créer un logement' })
  @ApiResponse({ status: 201, description: 'Logement créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  create(@Body() dto: CreateHousingDto) {
    return this.housingService.create(dto);
  }

  // RÉCUPÉRER TOUS LES LOGEMENTS
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BAILLEUR')
  @ApiOperation({ summary: 'Récupérer tous les logements' })
  @ApiResponse({ status: 200, description: 'Liste des logements récupérée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  findAll() {
    return this.housingService.findAll();
  }

  // RÉCUPÉRER UN LOGEMENT PAR ID
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BAILLEUR', 'LOCATAIRE')
  @ApiOperation({ summary: 'Récupérer un logement par ID' })
  @ApiResponse({ status: 200, description: 'Logement trouvé' })
  @ApiResponse({ status: 404, description: 'Logement non trouvé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.housingService.findOne(id);
  }

  // MISE À JOUR D’UN LOGEMENT
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BAILLEUR', 'ADMIN')
  @ApiOperation({ summary: 'Mettre à jour un logement' })
  @ApiResponse({ status: 200, description: 'Logement mis à jour' })
  @ApiResponse({ status: 404, description: 'Logement non trouvé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHousingDto,
  ) {
    return this.housingService.update(id, dto);
  }

  // SUPPRESSION D’UN LOGEMENT
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Supprimer un logement' })
  @ApiResponse({ status: 200, description: 'Logement supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Logement non trouvé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - rôle insuffisant' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.housingService.remove(id);
  }

  // ASSIGNER UN LOCATAIRE À UN LOGEMENT
  @Post('assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BAILLEUR', 'ADMIN')
  @ApiOperation({ summary: 'Assigner un locataire à un logement' })
  @ApiResponse({ status: 200, description: 'Locataire assigné avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides ou logement déjà occupé' })
  @ApiResponse({ status: 404, description: 'Logement ou locataire non trouvé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  assignTenant(@Body() dto: AssignTenantDto) {
    return this.housingService.assignTenant(dto);
  }
}
