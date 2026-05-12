import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ArtisansService } from './artisans.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateArtisanDto } from './dto/create-artisan.dto';
import { UpdateArtisanDto } from './dto/update-artisan.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';

@ApiTags('artisans')
@ApiBearerAuth('bearer')
@Controller('artisans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArtisansController {
  constructor(private readonly artisansService: ArtisansService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateArtisanDto) {
    return this.artisansService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'BAILLEUR')
  findAll() {
    return this.artisansService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'BAILLEUR', 'PRESTATAIRE')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.artisansService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateArtisanDto,
  ) {
    return this.artisansService.update(id, dto);
  }

  @Patch(':id/availability')
  @Roles('PRESTATAIRE')
  updateAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.artisansService.updateAvailability(id, dto);
  }

  @Post('assign-ticket')
  @Roles('ADMIN', 'BAILLEUR')
  assignTicket(@Body() dto: AssignTicketDto) {
    return this.artisansService.assignTicket(dto);
  }

  @Get(':id/tickets')
  @Roles('ADMIN', 'BAILLEUR', 'PRESTATAIRE')
  getTickets(@Param('id', ParseIntPipe) id: number) {
    return this.artisansService.getTicketsForArtisan(id);
  }

  @Get('available')
  @Roles('ADMIN', 'BAILLEUR')
  findAvailable() {
    return this.artisansService.findAvailable();
  }

  @Patch('/tickets/:id/resolve')
  @Roles('PRESTATAIRE', 'ADMIN')
  resolveTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { resolutionNote?: string },
  ) {
    return this.artisansService.resolveTicket(id, dto);
  }

  @Post('/tickets/:id/assign-auto')
  @Roles('ADMIN', 'BAILLEUR')
  autoAssign(@Param('id', ParseIntPipe) id: number) {
    return this.artisansService.autoAssignTicket(id);
  }
}
