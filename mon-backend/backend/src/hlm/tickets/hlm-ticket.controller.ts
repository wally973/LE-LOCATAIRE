import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
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
import { HlmTicketCategory } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../auth/guard/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateHlmTicketRequestDto } from '../dto/hlm-api.request.dto';
import type { CreateHlmTicketInput } from '../dto/hlm-input.dto';
import { HlmTicketService } from './hlm-ticket.service';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../../feature-flags/landlord-module.guard';

/**
 * Tickets métier HLM (routage garanties, blocage entretien).
 * Préfixe : `/hlm/tickets`
 */
@ApiTags('hlm-tickets')
@ApiBearerAuth('bearer')
@Controller('hlm/tickets')
@UseGuards(JwtAuthGuard, RolesGuard, LandlordModuleGuard)
@RequiresLandlordModule('hlmModule')
export class HlmTicketController {
  constructor(private readonly ticketService: HlmTicketService) {}

  @Post()
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary:
      'Créer un ticket HLM (blocage auto si entretien privatif / preuves manquantes)',
  })
  create(@Body() body: CreateHlmTicketRequestDto) {
    const dto: CreateHlmTicketInput = {
      title: body.title,
      description: body.description,
      category: body.category,
      urgency: body.urgency,
      status: body.status,
      logementId: body.logementId,
      locataireId: body.locataireId,
      routingNotes: body.routingNotes,
    };
    return this.ticketService.createTicket(dto);
  }

  @Get()
  @Roles('ADMIN', 'BAILLEUR', 'LOCATAIRE')
  @ApiOperation({ summary: 'Lister les tickets HLM' })
  list() {
    return this.ticketService.listTickets();
  }

  /** Vérifie si un ticket serait bloqué pour cause d’entretien / preuves (sans création). */
  @Get('maintenance-block/:logementId/:category')
  @Roles('ADMIN', 'BAILLEUR', 'LOCATAIRE')
  @ApiOperation({
    summary:
      'Contrôle blocage entretien (catégories extérieur / nuisibles — cf. service)',
  })
  maintenanceBlock(
    @Param('logementId', ParseUUIDPipe) logementId: string,
    @Param('category', new ParseEnumPipe(HlmTicketCategory))
    category: HlmTicketCategory,
  ) {
    return this.ticketService.blockIfMaintenanceMissing(logementId, category);
  }

  @Get(':id')
  @Roles('LOCATAIRE')
  @ApiOperation({ summary: 'Détail ticket HLM' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketService.getTicket(id);
  }

  @Patch(':id/route')
  @Roles('BAILLEUR')
  @ApiOperation({
    summary: 'Recalculer routage garantie / charge pour un ticket existant',
  })
  route(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketService.routeTicket(id);
  }
}
