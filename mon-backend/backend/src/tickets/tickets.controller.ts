import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  LandlordModuleGuard,
  RequiresLandlordModule,
} from '../feature-flags/landlord-module.guard';

@ApiTags('tickets')
@ApiBearerAuth('bearer')
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard, LandlordModuleGuard)
@RequiresLandlordModule('ticketsModule')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * Création d’un ticket par un locataire
   */
  @Post()
  @Roles('LOCATAIRE')
  createTicket(@Req() req, @Body() dto: CreateTicketDto) {
    const tenantId = req.user.id;
    return this.ticketsService.createTicket(tenantId, dto);
  }

  /**
   * Récupérer mes tickets selon mon rôle
   */
  @Get('me')
  @Roles('LOCATAIRE', 'BAILLEUR', 'AGENT', 'ADMIN')
  getMyTickets(@Req() req) {
    const userId = req.user.id;
    const role = req.user.role;
    return this.ticketsService.getMyTickets(userId, role);
  }

  /**
   * Récupérer mes tickets déjà routés par l'IA (locataire uniquement).
   * Renvoie un payload allégé pensé pour l'écran "mes diagnostics".
   */
  @Get('me/routed')
  @Roles('LOCATAIRE')
  getMyRoutedTickets(@Req() req) {
    return this.ticketsService.getMyRoutedTickets(req.user.id);
  }

  /**
   * Récupérer un ticket par ID
   */
  @Get(':id')
  @Roles('LOCATAIRE', 'BAILLEUR', 'AGENT', 'ADMIN')
  getTicketById(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.getTicketById(id);
  }

  /**
   * Mise à jour d’un ticket
   * - Locataire : peut modifier son ticket
   * - Bailleur : peut modifier les tickets de ses logements
   * - Admin : peut tout modifier
   */
  @Patch(':id')
  @Roles('LOCATAIRE', 'BAILLEUR', 'AGENT', 'ADMIN')
  updateTicket(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketDto,
  ) {
    const userId = req.user.id;
    const role = req.user.role;
    return this.ticketsService.updateTicket(userId, role, id, dto);
  }
}
