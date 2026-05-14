import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContratDto } from './dto/create-contrat.dto';
import { UpdateContratDto } from './dto/update-contrat.dto';

const contratInclude = {
  landlord: { include: { user: { select: { id: true, email: true, phone: true } } } },
  tenant: { include: { user: { select: { id: true, email: true, phone: true } } } },
  housing: true,
} as const;

@Injectable()
export class ContratsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContratDto) {
    try {
      return await this.prisma.contratLocation.create({
        data: {
          landlordProfileId: dto.landlordProfileId,
          tenantProfileId: dto.tenantProfileId,
          housingId: dto.housingId,
          dateDebut: new Date(dto.dateDebut),
          dateFin: dto.dateFin != null ? new Date(dto.dateFin) : null,
          loyerMensuel: dto.loyerMensuel,
          depotGarantie: dto.depotGarantie ?? null,
          statut: dto.statut,
        },
        include: contratInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Référence invalide : bailleur, locataire ou logement introuvable',
        );
      }
      throw e;
    }
  }

  /**
   * Liste les contrats. Si un `landlordProfileId` de scope est fourni (multi-tenant),
   * seuls les contrats de ce bailleur sont retournés. Sinon tout (réservé ADMIN).
   */
  findAll(scope?: { landlordProfileId?: number }) {
    return this.prisma.contratLocation.findMany({
      where: scope?.landlordProfileId
        ? { landlordProfileId: scope.landlordProfileId }
        : undefined,
      orderBy: { id: 'asc' },
      include: contratInclude,
    });
  }

  async findOne(id: number, scope?: { landlordProfileId?: number }) {
    const row = await this.prisma.contratLocation.findUnique({
      where: { id },
      include: contratInclude,
    });
    if (!row) {
      throw new NotFoundException(`Contrat #${id} introuvable`);
    }
    if (
      scope?.landlordProfileId !== undefined &&
      row.landlordProfileId !== scope.landlordProfileId
    ) {
      throw new NotFoundException(`Contrat #${id} introuvable`);
    }
    return row;
  }

  async update(
    id: number,
    dto: UpdateContratDto,
    scope?: { landlordProfileId?: number },
  ) {
    await this.findOne(id, scope);
    try {
      return await this.prisma.contratLocation.update({
        where: { id },
        data: {
          ...(dto.landlordProfileId !== undefined && {
            landlordProfileId: dto.landlordProfileId,
          }),
          ...(dto.tenantProfileId !== undefined && {
            tenantProfileId: dto.tenantProfileId,
          }),
          ...(dto.housingId !== undefined && { housingId: dto.housingId }),
          ...(dto.dateDebut !== undefined && {
            dateDebut: new Date(dto.dateDebut),
          }),
          ...(dto.dateFin !== undefined && {
            dateFin: dto.dateFin != null ? new Date(dto.dateFin) : null,
          }),
          ...(dto.loyerMensuel !== undefined && {
            loyerMensuel: dto.loyerMensuel,
          }),
          ...(dto.depotGarantie !== undefined && {
            depotGarantie: dto.depotGarantie,
          }),
          ...(dto.statut !== undefined && { statut: dto.statut }),
        },
        include: contratInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Référence invalide : bailleur, locataire ou logement introuvable',
        );
      }
      throw e;
    }
  }

  async remove(id: number, scope?: { landlordProfileId?: number }) {
    await this.findOne(id, scope);
    return this.prisma.contratLocation.delete({
      where: { id },
      include: contratInclude,
    });
  }
}
