import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
import { CreateSocialWorkerDto } from './dto/create-social-worker.dto';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../feature-flags/landlord-module.guard';

/**
 * Bailleur / agent — gestion des référents sociaux (comptes utilisateurs existants — P6).
 */
@ApiTags('landlord-social-workers')
@ApiBearerAuth('bearer')
@Controller('landlords/me/social-workers')
@UseGuards(JwtAuthGuard, RolesGuard, BailleurScopeGuard, LandlordModuleGuard)
@RequiresLandlordModule('socialModule')
export class LandlordSocialWorkersController {
  constructor(private readonly socialCases: SocialCasesService) {}

  @Get()
  @Roles('BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Lister les référents sociaux de mon organisme' })
  list(@BailleurScope() scope: BailleurScopeType) {
    return this.socialCases.listSocialWorkers(scope);
  }

  @Post()
  @Roles('BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Ajouter un référent social (userId existant)' })
  create(
    @BailleurScope() scope: BailleurScopeType,
    @Body() dto: CreateSocialWorkerDto,
  ) {
    return this.socialCases.createSocialWorker(scope, dto);
  }

  @Delete(':id')
  @Roles('BAILLEUR', 'AGENT')
  @ApiOperation({ summary: 'Retirer un référent social' })
  remove(
    @BailleurScope() scope: BailleurScopeType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.socialCases.deleteSocialWorker(scope, id);
  }
}
