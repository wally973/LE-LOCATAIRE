import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BailleurScopeGuard } from '../auth/scope/bailleur-scope.guard';
import { BailleurScope } from '../auth/decorators/bailleur-scope.decorator';
import type { BailleurScope as BailleurScopeType } from '../auth/scope/bailleur-scope.types';
import { SocialCasesService } from './social-cases.service';
import { UpdateSocialCaseDto } from './dto/update-social-case.dto';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../feature-flags/landlord-module.guard';

/**
 * Bailleur / agent — gestion des dossiers sociaux de leur organisme (P2).
 */
@ApiTags('landlord-social-cases')
@ApiBearerAuth('bearer')
@Controller('landlords/me/social-cases')
@UseGuards(JwtAuthGuard, RolesGuard, BailleurScopeGuard, LandlordModuleGuard)
@RequiresLandlordModule('socialModule')
export class LandlordSocialCasesController {
  constructor(private readonly socialCases: SocialCasesService) {}

  @Get()
  @Roles('BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Lister les dossiers sociaux de mon organisme' })
  list(@BailleurScope() scope: BailleurScopeType) {
    return this.socialCases.listForLandlord(scope);
  }

  @Get(':id')
  @Roles('BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Détail d’un dossier social' })
  detail(
    @BailleurScope() scope: BailleurScopeType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.socialCases.findOneScoped(id, scope, 'landlord');
  }

  @Patch(':id')
  @Roles('BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Mettre à jour un dossier social' })
  patch(
    @Req() req,
    @BailleurScope() scope: BailleurScopeType,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSocialCaseDto,
  ) {
    return this.socialCases.updateForLandlord(id, dto, scope, req.user.id);
  }
}
