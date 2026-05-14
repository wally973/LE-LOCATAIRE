import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaiementDto } from './dto/create-paiement.dto';
import { UpdatePaiementDto } from './dto/update-paiement.dto';

const paiementInclude = {
  contrat: {
    include: {
      landlord: { select: { id: true, name: true } },
      tenant: { select: { id: true, firstName: true, lastName: true } },
      housing: { select: { id: true, address: true, city: true } },
    },
  },
} as const;

@Injectable()
export class PaiementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaiementDto) {
    try {
      return await this.prisma.paiement.create({
        data: {
          contratId: dto.contratId,
          datePaiement: new Date(dto.datePaiement),
          montant: dto.montant,
          moyenPaiement: dto.moyenPaiement,
          statut: dto.statut,
          reference: dto.reference ?? null,
        },
        include: paiementInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new BadRequestException('Contrat introuvable ou invalide');
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Cette référence de paiement est déjà utilisée',
        );
      }
      throw e;
    }
  }

  /**
   * Liste les paiements. Si un `landlordProfileId` de scope est fourni,
   * seuls les paiements dont le contrat appartient à ce bailleur sont retournés.
   */
  findAll(scope?: { landlordProfileId?: number }) {
    return this.prisma.paiement.findMany({
      where: scope?.landlordProfileId
        ? { contrat: { landlordProfileId: scope.landlordProfileId } }
        : undefined,
      orderBy: { id: 'asc' },
      include: paiementInclude,
    });
  }

  async findOne(id: number, scope?: { landlordProfileId?: number }) {
    const row = await this.prisma.paiement.findUnique({
      where: { id },
      include: paiementInclude,
    });
    if (!row) {
      throw new NotFoundException(`Paiement #${id} introuvable`);
    }
    if (
      scope?.landlordProfileId !== undefined &&
      row.contrat.landlordProfileId !== scope.landlordProfileId
    ) {
      throw new NotFoundException(`Paiement #${id} introuvable`);
    }
    return row;
  }

  async update(
    id: number,
    dto: UpdatePaiementDto,
    scope?: { landlordProfileId?: number },
  ) {
    await this.findOne(id, scope);
    try {
      return await this.prisma.paiement.update({
        where: { id },
        data: {
          ...(dto.contratId !== undefined && { contratId: dto.contratId }),
          ...(dto.datePaiement !== undefined && {
            datePaiement: new Date(dto.datePaiement),
          }),
          ...(dto.montant !== undefined && { montant: dto.montant }),
          ...(dto.moyenPaiement !== undefined && {
            moyenPaiement: dto.moyenPaiement,
          }),
          ...(dto.statut !== undefined && { statut: dto.statut }),
          ...(dto.reference !== undefined && {
            reference: dto.reference ?? null,
          }),
        },
        include: paiementInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new BadRequestException('Contrat introuvable ou invalide');
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Cette référence de paiement est déjà utilisée',
        );
      }
      throw e;
    }
  }

  async remove(id: number, scope?: { landlordProfileId?: number }) {
    await this.findOne(id, scope);
    return this.prisma.paiement.delete({
      where: { id },
      include: paiementInclude,
    });
  }
}
