import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
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
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../feature-flags/landlord-module.guard';

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

  @Get('me/tickets')
  @Roles('BAILLEUR')
  @UseGuards(BailleurScopeGuard, LandlordModuleGuard)
  @RequiresLandlordModule('ticketsModule')
  getMyTickets(@CurrentUser() user) {
    return this.landlordsService.getMyTickets(user.userId);
  }

  @Get('me/artisans')
  @Roles('BAILLEUR')
  getMyArtisans(@CurrentUser() user) {
    return this.landlordsService.getMyArtisans(user.userId);
  }

  @Get('me/feature-flags')
  @Roles('BAILLEUR')
  @ApiOperation({ summary: 'Modules activés pour mon compte bailleur (lecture seule)' })
  getMyFeatureFlags(@CurrentUser() user: { userId: number }) {
    return this.featureFlags.getByLandlordUserId(user.userId);
  }
}
