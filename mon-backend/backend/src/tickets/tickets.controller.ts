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
import { PostTicketMessageDto } from '../lia/dto/post-ticket-message.dto';
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

  @Get('lookup/case/:caseNumber')
  @Roles('LOCATAIRE', 'BAILLEUR', 'AGENT', 'ADMIN')
  @ApiOperation({
    summary: 'Ouvrir un dossier par numéro d’affaire (AFF-…)',
    description:
      'Retourne le locataire, l’affaire concernée et l’historique de ses demandes.',
  })
  lookupByCase(@Req() req, @Param('caseNumber') caseNumber: string) {
    return this.ticketsService.lookupByCaseNumber(
      caseNumber,
      req.user.id,
      req.user.role,
    );
  }

  @Get('lookup/dossier/:dossierNumber')
  @Roles('BAILLEUR', 'AGENT', 'ADMIN', 'LOCATAIRE')
  @ApiOperation({
    summary: 'Ouvrir un dossier locataire par numéro DOS-…',
  })
  lookupByDossier(
    @Req() req,
    @Param('dossierNumber') dossierNumber: string,
  ) {
    return this.ticketsService.lookupByDossierNumber(
      dossierNumber,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * Récupérer un ticket par ID
   */
  @Get(':id/messages')
  @Roles('LOCATAIRE', 'BAILLEUR', 'AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Fil de conversation Lia d’un ticket' })
  getTicketMessages(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.getTicketMessages(id, req.user.id, req.user.role);
  }

  @Post(':id/messages')
  @Roles('LOCATAIRE')
  @ApiOperation({
    summary: 'Message locataire dans le fil — relance l’analyse en arrière-plan',
  })
  postTicketMessage(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PostTicketMessageDto,
  ) {
    return this.ticketsService.postTenantMessage(id, req.user.id, dto.content);
  }

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
