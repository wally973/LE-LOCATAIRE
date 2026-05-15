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
import { CreateEntretienTypeRequestDto } from '../dto/hlm-api.request.dto';
import type { CreateEntretienTypeInput } from '../dto/hlm-input.dto';
import { HlmEntretienService } from './hlm-entretien.service';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../../feature-flags/landlord-module.guard';

/**
 * Catalogue et plans d’entretien HLM.
 * Préfixe : `/hlm/entretien`
 */
@ApiTags('hlm-entretien')
@ApiBearerAuth('bearer')
@Controller('hlm/entretien')
@UseGuards(JwtAuthGuard, RolesGuard, LandlordModuleGuard)
@RequiresLandlordModule('hlmModule')
export class HlmEntretienController {
  constructor(private readonly entretienService: HlmEntretienService) {}

  @Get('types')
  @Roles('ADMIN', 'BAILLEUR', 'LOCATAIRE')
  @ApiOperation({ summary: 'Liste des types d’entretien catalogue' })
  listTypes() {
    return this.entretienService.listEntretienTypes();
  }

  @Post('types')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Créer un type d’entretien (catalogue)' })
  createType(@Body() body: CreateEntretienTypeRequestDto) {
    const dto: CreateEntretienTypeInput = {
      code: body.code,
      labelFr: body.labelFr,
      description: body.description,
      frequency: body.frequency,
      requiresOutdoorContext: body.requiresOutdoorContext,
    };
    return this.entretienService.createEntretienType(dto);
  }

  @Get('logement/:logementId')
  @Roles('LOCATAIRE')
  @ApiOperation({ summary: 'Plans d’entretien pour un logement' })
  getForLogement(@Param('logementId', ParseUUIDPipe) logementId: string) {
    return this.entretienService.getLogementEntretien(logementId);
  }

  @Post('logement/:logementId/assign/:typeId')
  @Roles('ADMIN', 'BAILLEUR')
  @ApiOperation({ summary: 'Rattacher un type du catalogue à un logement' })
  assign(
    @Param('logementId', ParseUUIDPipe) logementId: string,
    @Param('typeId', ParseUUIDPipe) typeId: string,
  ) {
    return this.entretienService.assignEntretienToLogement(logementId, typeId);
  }

  @Patch(':logementEntretienId/done')
  @Roles('LOCATAIRE')
  @ApiOperation({ summary: 'Marquer une ligne de plan comme réalisée et recaler l’échéance' })
  markDone(
    @Param('logementEntretienId', ParseUUIDPipe) logementEntretienId: string,
  ) {
    return this.entretienService.markAsDone(logementEntretienId);
  }
}
