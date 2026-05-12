import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../auth/guard/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  AssignLocataireRequestDto,
  CreateLogementRequestDto,
  UpdateLogementRequestDto,
} from '../dto/hlm-api.request.dto';
import type {
  CreateLogementInput,
  UpdateLogementInput,
} from '../dto/hlm-input.dto';
import { HlmLogementService } from './hlm-logement.service';

/**
 * API REST socle HLM — logements patrimoine (unités / équipements).
 * Préfixe : `/hlm/logements`
 */
@ApiTags('hlm-logements')
@ApiBearerAuth('bearer')
@Controller('hlm/logements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HlmLogementController {
  constructor(private readonly logementService: HlmLogementService) {}

  @Post()
  @Roles('BAILLEUR')
  @ApiOperation({ summary: 'Créer un logement HLM' })
  create(@Body() body: CreateLogementRequestDto) {
    const dto: CreateLogementInput = {
      residenceId: body.residenceId,
      label: body.label,
      externalRef: body.externalRef,
      hasVmc: body.hasVmc,
      hasSolarWaterHeater: body.hasSolarWaterHeater,
      hasCour: body.hasCour,
      hasJardin: body.hasJardin,
      hasTerrasse: body.hasTerrasse,
      hasPatio: body.hasPatio,
    };
    return this.logementService.createLogement(dto);
  }

  @Get()
  @Roles('ADMIN', 'BAILLEUR')
  @ApiOperation({ summary: 'Lister tous les logements HLM' })
  listAll() {
    return this.logementService.listAllLogements();
  }

  /** Route statique avant :id pour éviter collision */
  @Get('residence/:residenceId')
  @Roles('ADMIN', 'BAILLEUR', 'LOCATAIRE')
  @ApiOperation({ summary: 'Lister les logements d’une résidence' })
  listByResidence(@Param('residenceId', ParseUUIDPipe) residenceId: string) {
    return this.logementService.listLogementsByResidence(residenceId);
  }

  @Get(':id')
  @Roles('ADMIN', 'BAILLEUR', 'LOCATAIRE')
  @ApiOperation({ summary: 'Détail logement' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.logementService.getLogement(id);
  }

  @Patch(':id')
  @Roles('BAILLEUR')
  @ApiOperation({ summary: 'Mettre à jour un logement' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateLogementRequestDto,
  ) {
    const dto: UpdateLogementInput = {
      label: body.label,
      externalRef: body.externalRef,
      hasVmc: body.hasVmc,
      hasSolarWaterHeater: body.hasSolarWaterHeater,
      hasCour: body.hasCour,
      hasJardin: body.hasJardin,
      hasTerrasse: body.hasTerrasse,
      hasPatio: body.hasPatio,
    };
    return this.logementService.updateLogement(id, dto);
  }

  @Patch(':id/assign-locataire')
  @Roles('ADMIN', 'BAILLEUR')
  @ApiOperation({ summary: 'Associer un locataire HLM au logement' })
  assignLocataire(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignLocataireRequestDto,
  ) {
    return this.logementService.assignLocataire(id, body.locataireId);
  }

  @Patch(':id/unassign-locataire')
  @Roles('ADMIN', 'BAILLEUR')
  @ApiOperation({ summary: 'Retirer le locataire du logement' })
  unassignLocataire(@Param('id', ParseUUIDPipe) id: string) {
    return this.logementService.unassignLocataire(id);
  }

  @Post(':id/init-entretien')
  @Roles('ADMIN', 'BAILLEUR')
  @ApiOperation({
    summary:
      'Initialiser / mettre à jour le plan d’entretien selon équipements déclarés',
  })
  initEntretien(@Param('id', ParseUUIDPipe) id: string) {
    return this.logementService.initEntretienPlan(id);
  }
}
