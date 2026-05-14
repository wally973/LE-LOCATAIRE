import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ArtisanRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ArtisanRequestsService } from './artisan-requests.service';
import { UpdateArtisanRequestDto } from './dto/update-artisan-request.dto';

/**
 * Backoffice admin (owner) — gère le pipeline complet d'une ArtisanRequest.
 * Réservé au rôle ADMIN.
 */
@ApiTags('admin-artisan-requests')
@ApiBearerAuth('bearer')
@Controller('admin/artisan-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArtisanRequestsAdminController {
  constructor(
    private readonly artisanRequests: ArtisanRequestsService,
  ) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Lister toutes les demandes d’artisan (filtrable)',
  })
  @ApiQuery({ name: 'status', required: false, enum: ArtisanRequestStatus })
  @ApiQuery({ name: 'landlordProfileId', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  list(
    @Query('status') status?: ArtisanRequestStatus,
    @Query('landlordProfileId') landlordProfileId?: string,
    @Query('category') category?: string,
  ) {
    return this.artisanRequests.listForAdmin({
      status,
      landlordProfileId: landlordProfileId
        ? parseInt(landlordProfileId, 10)
        : undefined,
      category,
    });
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Détail complet d’une demande d’artisan' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.artisanRequests.findOneForAdmin(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Patcher une demande : statut, notes admin, créneaux, date de complétion',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateArtisanRequestDto,
  ) {
    return this.artisanRequests.updateForAdmin(id, dto);
  }
}
