import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FeatureFlagsService } from './feature-flags.service';
import { UpdateFeatureFlagsDto } from './dto/update-feature-flags.dto';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('admin')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/landlords')
export class AdminFeatureFlagsController {
  constructor(
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/feature-flags')
  @ApiOperation({ summary: 'Feature flags d’un bailleur (par id utilisateur)' })
  async getFlags(@Param('id', ParseIntPipe) userId: number) {
    const profile = await this.resolveLandlordProfile(userId);
    return this.featureFlags.getOrCreateForLandlordProfile(profile.id);
  }

  @Patch(':id/feature-flags')
  @ApiOperation({ summary: 'Activer / désactiver des modules pour un bailleur' })
  async patchFlags(
    @Param('id', ParseIntPipe) userId: number,
    @Body() dto: UpdateFeatureFlagsDto,
  ) {
    const profile = await this.resolveLandlordProfile(userId);
    return this.featureFlags.updateForLandlordProfile(profile.id, dto);
  }

  private async resolveLandlordProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        landlord: { select: { id: true } },
      },
    });
    if (!user?.landlord) {
      throw new NotFoundException('Bailleur introuvable');
    }
    return user.landlord;
  }
}
