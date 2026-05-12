import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArtisanDto } from './dto/create-artisan.dto';
import { UpdateArtisanDto } from './dto/update-artisan.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class ArtisansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateArtisanDto) {
    return this.prisma.user.create({
      data: {
        role: 'PRESTATAIRE',
        email: dto.email,
        phone: dto.phone,
        password: dto.password,
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      where: { role: 'PRESTATAIRE' },
    });
  }

  async findOne(id: number) {
    const artisan = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!artisan || artisan.role !== 'PRESTATAIRE') {
      throw new NotFoundException('Artisan introuvable');
    }

    return artisan;
  }

  async update(id: number, dto: UpdateArtisanDto) {
    const artisan = await this.prisma.user.findUnique({ where: { id } });

    if (!artisan || artisan.role !== 'PRESTATAIRE') {
      throw new NotFoundException('Artisan introuvable');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        phone: dto.phone,
      },
    });
  }

  async assignTicket(dto: AssignTicketDto) {
    const artisan = await this.prisma.user.findUnique({
      where: { id: dto.artisanId },
    });

    if (!artisan || artisan.role !== 'PRESTATAIRE') {
      throw new NotFoundException('Artisan introuvable');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }

    // On crée un PlanningSlot pour assigner l’artisan
    return this.prisma.planningSlot.create({
      data: {
        artisanId: dto.artisanId,
        ticketId: dto.ticketId,
        startDate: new Date(),
        endDate: new Date(),
        status: 'ASSIGNED',
      },
    });
  }

  async updateAvailability(id: number, dto: UpdateAvailabilityDto) {
    const artisan = await this.prisma.user.findUnique({ where: { id } });

    if (!artisan || artisan.role !== 'PRESTATAIRE') {
      throw new NotFoundException('Artisan introuvable');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isAvailable: dto.isAvailable },
    });
  }

  async getTicketsForArtisan(id: number) {
    const artisan = await this.prisma.user.findUnique({ where: { id } });

    if (!artisan || artisan.role !== 'PRESTATAIRE') {
      throw new NotFoundException('Artisan introuvable');
    }

    return this.prisma.planningSlot.findMany({
      where: { artisanId: id },
      include: { ticket: true },
    });
  }

  async findAvailable() {
    return this.prisma.user.findMany({
      where: { role: 'PRESTATAIRE', isAvailable: true },
    });
  }

  async resolveTicket(id: number, dto: { resolutionNote?: string }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }

    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolutionNote: dto.resolutionNote,
      },
    });
  }

  async autoAssignTicket(ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }

    const availableArtisan = await this.prisma.user.findFirst({
      where: { role: 'PRESTATAIRE', isAvailable: true },
    });

    if (!availableArtisan) {
      throw new BadRequestException('Aucun artisan disponible');
    }

    return this.prisma.planningSlot.create({
      data: {
        artisanId: availableArtisan.id,
        ticketId,
        startDate: new Date(),
        endDate: new Date(),
        status: 'ASSIGNED',
      },
    });
  }
}
