import {
  Body,
  Controller,
  Delete,
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
  CreateResidenceRequestDto,
  UpdateResidenceRequestDto,
} from '../dto/hlm-api.request.dto';
import type { CreateResidenceInput, UpdateResidenceInput } from '../dto/hlm-input.dto';
import { HlmResidenceService } from './hlm-residence.service';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../../feature-flags/landlord-module.guard';

/**
 * API REST socle HLM — résidences & dates garanties (GPA / biennale / décennale).
 * Préfixe : `/hlm/residences`
 */
@ApiTags('hlm-residences')
@ApiBearerAuth('bearer')
@Controller('hlm/residences')
@UseGuards(JwtAuthGuard, RolesGuard, LandlordModuleGuard)
@RequiresLandlordModule('hlmModule')
export class HlmResidenceController {
  constructor(private readonly residenceService: HlmResidenceService) {}

  @Post()
  @Roles('BAILLEUR')
  @ApiOperation({ summary: 'Créer une résidence et calculer les échéances garantie' })
  create(@Body() body: CreateResidenceRequestDto) {
    const dto: CreateResidenceInput = {
      bailleurId: body.bailleurId,
      name: body.name,
      deliveryDate: new Date(body.deliveryDate),
      constructionYear: body.constructionYear,
      residenceNeuve: body.residenceNeuve,
      hasInternalGPAServicePerResidence: body.hasInternalGPAServicePerResidence,
    };
    return this.residenceService.createResidence(dto);
  }

  @Get()
  @Roles('ADMIN', 'BAILLEUR')
  @ApiOperation({ summary: 'Lister les résidences HLM' })
  list() {
    return this.residenceService.listResidences();
  }

  @Get(':id')
  @Roles('ADMIN', 'BAILLEUR', 'LOCATAIRE')
  @ApiOperation({ summary: 'Détail résidence' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.residenceService.getResidence(id);
  }

  @Patch(':id')
  @Roles('BAILLEUR')
  @ApiOperation({ summary: 'Mettre à jour une résidence (recalcul garanties si livraison changée)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateResidenceRequestDto,
  ) {
    const dto: UpdateResidenceInput = {
      name: body.name,
      deliveryDate: body.deliveryDate
        ? new Date(body.deliveryDate)
        : undefined,
      constructionYear: body.constructionYear,
      residenceNeuve: body.residenceNeuve,
      hasInternalGPAServicePerResidence: body.hasInternalGPAServicePerResidence,
    };
    return this.residenceService.updateResidence(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Supprimer une résidence (attention aux logements liés)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.residenceService.deleteResidence(id);
  }
}
