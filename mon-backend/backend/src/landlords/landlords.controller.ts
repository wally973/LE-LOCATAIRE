import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LandlordsService } from './landlords.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { LandlordUpdateProfileDto } from './dto/landlord-update-profile.dto';
import { ValidateHousingDto } from './dto/validate-housing.dto';
import { BailleurScopeGuard } from '../auth/scope/bailleur-scope.guard';
import { BailleurScope } from '../auth/decorators/bailleur-scope.decorator';
import type { BailleurScope as BailleurScopeType } from '../auth/scope/bailleur-scope.types';
import { TicketResponsibility } from '@prisma/client';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../feature-flags/landlord-module.guard';
import { UpdateQualificationFlagsDto } from '../feature-flags/dto/update-qualification-flags.dto';

@ApiTags('landlords')
@ApiBearerAuth('bearer')
@Controller('landlords')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LandlordsController {
  constructor(
    private readonly landlordsService: LandlordsService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Get('me')
  @Roles('BAILLEUR')
  getProfile(@CurrentUser() user) {
    return this.landlordsService.getProfile(user.userId);
  }

  @Patch('me')
  @Roles('BAILLEUR')
  updateProfile(
    @CurrentUser() user,
    @Body() dto: LandlordUpdateProfileDto,
  ) {
    return this.landlordsService.updateProfile(user.userId, dto);
  }

  @Get('me/housings')
  @Roles('BAILLEUR')
  getMyHousings(@CurrentUser() user) {
    return this.landlordsService.getMyHousings(user.userId);
  }

  @Patch('housing/:id/validate')
  @Roles('BAILLEUR', 'ADMIN')
  validateHousing(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user,
    @Body() dto: ValidateHousingDto,
  ) {
    return this.landlordsService.validateHousing(id, dto, user.userId);
  }

  @Get('me/dashboard')
  @Roles('BAILLEUR', 'AGENT')
  @UseGuards(BailleurScopeGuard, LandlordModuleGuard)
  @RequiresLandlordModule('ticketsModule')
  @ApiOperation({
    summary:
      'Tableau de bord bailleur — KPI, tickets par responsabilité, escalades IA',
  })
  getDashboard(@BailleurScope() scope: BailleurScopeType) {
    if (!scope.landlordProfileId) {
      throw new ForbiddenException('Profil bailleur requis');
    }
    return this.landlordsService.getDashboard(scope.landlordProfileId);
  }

  @Get('me/tickets')
  @Roles('BAILLEUR', 'AGENT')
  @UseGuards(BailleurScopeGuard, LandlordModuleGuard)
  @RequiresLandlordModule('ticketsModule')
  getMyTickets(
    @BailleurScope() scope: BailleurScopeType,
    @Query('responsibility') responsibility?: TicketResponsibility,
  ) {
    if (!scope.landlordProfileId) {
      throw new ForbiddenException('Profil bailleur requis');
    }
    return this.landlordsService.getMyTicketsByLandlordProfile(
      scope.landlordProfileId,
      { responsibility },
    );
  }

  @Get('me/artisans')
  @Roles('BAILLEUR')
  getMyArtisans(@CurrentUser() user) {
    return this.landlordsService.getMyArtisans(user.userId);
  }

  @Get('me/feature-flags')
  @Roles('BAILLEUR')
  @ApiOperation({ summary: 'Modules et actions de qualification de mon bailleur' })
  getMyFeatureFlags(@CurrentUser() user: { userId: number }) {
    return this.featureFlags.getByLandlordUserId(user.userId);
  }

  @Patch('me/qualification-settings')
  @Roles('BAILLEUR')
  @ApiOperation({
    summary: 'Activer / désactiver les actions de qualification (Lia, photo, recherche…)',
  })
  async patchMyQualificationSettings(
    @CurrentUser() user: { userId: number },
    @Body() dto: UpdateQualificationFlagsDto,
  ) {
    const row = await this.featureFlags.getByLandlordUserId(user.userId);
    return this.featureFlags.updateQualificationFlags(
      row.landlordProfileId,
      dto,
    );
  }
}
