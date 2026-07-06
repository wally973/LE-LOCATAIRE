import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../auth/guard/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GrockBailleurService } from './grock-bailleur.service';
import { ConverseGrockLandlordDto } from './dto/grock-bailleur.dto';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../../feature-flags/landlord-module.guard';

/**
 * Surface bailleur — même moteur Grock (5 têtes), interlocuteur patrimoine.
 * Scores et PreprocessedSignal exposés dans la réponse (usage interne bailleur).
 */
@ApiTags('grock-bailleur')
@ApiBearerAuth()
@Controller('landlords/me/grock')
@UseGuards(JwtAuthGuard, RolesGuard, LandlordModuleGuard)
@Roles('BAILLEUR', 'AGENT', 'ADMIN')
@RequiresLandlordModule('ticketsModule')
export class GrockBailleurController {
  constructor(private readonly grockBailleur: GrockBailleurService) {}

  @Post('converse')
  @ApiOperation({
    summary: 'Dialogue bailleur ↔ Grock sur un dossier ticket (patrimoine)',
  })
  converse(
    @Req() req: { user: { userId: number } },
    @Body() dto: ConverseGrockLandlordDto,
  ) {
    return this.grockBailleur.converseOnTicket(req.user.userId, dto);
  }
}
