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
  SubmitProofRequestDto,
  ValidateAiRequestDto,
  ValidateLandlordRequestDto,
} from '../dto/hlm-api.request.dto';
import type {
  SubmitProofInput,
  ValidateProofAiInput,
} from '../dto/hlm-input.dto';
import { HlmPreuveService } from './hlm-preuve.service';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../../feature-flags/landlord-module.guard';

/**
 * Preuves d’entretien (2 photos + checklist JSON).
 * Préfixe : `/hlm/preuves`
 */
@ApiTags('hlm-preuves')
@ApiBearerAuth('bearer')
@Controller('hlm/preuves')
@UseGuards(JwtAuthGuard, RolesGuard, LandlordModuleGuard)
@RequiresLandlordModule('hlmModule')
export class HlmPreuveController {
  constructor(private readonly preuveService: HlmPreuveService) {}

  @Post(':logementEntretienId')
  @Roles('LOCATAIRE')
  @ApiOperation({ summary: 'Soumettre une preuve (photos obligatoires)' })
  submit(
    @Param('logementEntretienId', ParseUUIDPipe) logementEntretienId: string,
    @Body() body: SubmitProofRequestDto,
  ) {
    const dto: SubmitProofInput = {
      checklist: body.checklist,
      photo1Url: body.photo1Url,
      photo2Url: body.photo2Url,
      locataireId: body.locataireId,
    };
    return this.preuveService.submitProof(logementEntretienId, dto);
  }

  @Get('logement/:logementId')
  @Roles('LOCATAIRE')
  @ApiOperation({ summary: 'Historique des preuves pour un logement' })
  listForLogement(@Param('logementId', ParseUUIDPipe) logementId: string) {
    return this.preuveService.listProofsForLogement(logementId);
  }

  @Patch(':id/validate-landlord')
  @Roles('BAILLEUR')
  @ApiOperation({ summary: 'Validation bailleur / gestionnaire' })
  validateLandlord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ValidateLandlordRequestDto,
  ) {
    return this.preuveService.validateProofByLandlord(id, body.accepted);
  }

  @Patch(':id/validate-ai')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Validation / refus pipeline IA' })
  validateAi(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ValidateAiRequestDto,
  ) {
    const payload: ValidateProofAiInput = {
      accepted: body.accepted,
      confidence: body.confidence,
      details: body.details,
    };
    return this.preuveService.validateProofByAI(id, payload);
  }
}
