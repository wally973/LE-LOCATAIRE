import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ArtisanRequestsService } from './artisan-requests.service';
import { CreateArtisanRequestDto } from './dto/create-artisan-request.dto';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../feature-flags/landlord-module.guard';

/**
 * Endpoint locataire — bascule un ticket LOCATAIRE en demande d'artisan.
 */
@ApiTags('artisan-requests')
@ApiBearerAuth('bearer')
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard, LandlordModuleGuard)
@RequiresLandlordModule('artisanRequestsModule')
export class ArtisanRequestsTenantController {
  constructor(
    private readonly artisanRequests: ArtisanRequestsService,
  ) {}

  @Post(':id/artisan-request')
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary: 'Demander un artisan pour un ticket à votre charge',
  })
  @ApiResponse({
    status: 201,
    description: 'Demande d’artisan créée (status=NEW)',
  })
  create(
    @Req() req,
    @Param('id', ParseIntPipe) ticketId: number,
    @Body() dto: CreateArtisanRequestDto,
  ) {
    return this.artisanRequests.createFromTicket(req.user.id, ticketId, dto);
  }
}
