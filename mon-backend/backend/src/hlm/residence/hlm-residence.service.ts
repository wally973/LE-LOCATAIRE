import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { HlmResidence } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateResidenceInput,
  UpdateResidenceInput,
} from '../dto/hlm-input.dto';
import type { HlmResidenceDto, WarrantyDatesDto } from '../dto/hlm-shared.dto';
import {
  computeWarrantyWindow,
  type WarrantyWindow,
} from '../utils/hlm-warranty.util';

@Injectable()
export class HlmResidenceService {
  constructor(private readonly prisma: PrismaService) {}

  computeWarrantyDates(deliveryDate: Date): WarrantyWindow {
    return computeWarrantyWindow(deliveryDate);
  }

  async createResidence(dto: CreateResidenceInput): Promise<HlmResidenceDto> {
    const bailleur = await this.prisma.hlmBailleur.findUnique({
      where: { id: dto.bailleurId },
    });
    if (!bailleur) {
      throw new NotFoundException(`Bailleur patrimoine introuvable`);
    }
    const { gpaEnd, biennaleEnd, decennaleEnd } = this.computeWarrantyDates(
      dto.deliveryDate,
    );
    const row = await this.prisma.hlmResidence.create({
      data: {
        bailleurId: dto.bailleurId,
        name: dto.name,
        constructionYear: dto.constructionYear ?? null,
        deliveryDate: dto.deliveryDate,
        residenceNeuve: dto.residenceNeuve ?? false,
        hasInternalGPAServicePerResidence:
          dto.hasInternalGPAServicePerResidence ?? false,
        gpaEndDate: gpaEnd,
        biennaleEndDate: biennaleEnd,
        decennaleEndDate: decennaleEnd,
      },
    });
    return this.toDto(row);
  }

  async updateResidence(
    id: string,
    dto: UpdateResidenceInput,
  ): Promise<HlmResidenceDto> {
    await this.ensureResidence(id);
    let warrantyPatch: {
      gpaEndDate?: Date;
      biennaleEndDate?: Date;
      decennaleEndDate?: Date;
    } = {};
    if (dto.deliveryDate) {
      const w = this.computeWarrantyDates(dto.deliveryDate);
      warrantyPatch = {
        gpaEndDate: w.gpaEnd,
        biennaleEndDate: w.biennaleEnd,
        decennaleEndDate: w.decennaleEnd,
      };
    }
    const row = await this.prisma.hlmResidence.update({
      where: { id },
      data: {
        name: dto.name,
        deliveryDate: dto.deliveryDate,
        constructionYear: dto.constructionYear,
        residenceNeuve: dto.residenceNeuve,
        hasInternalGPAServicePerResidence:
          dto.hasInternalGPAServicePerResidence,
        ...warrantyPatch,
      },
    });
    return this.toDto(row);
  }

  async getResidence(id: string): Promise<HlmResidenceDto> {
    const row = await this.prisma.hlmResidence.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Résidence introuvable`);
    return this.toDto(row);
  }

  async listResidences(): Promise<HlmResidenceDto[]> {
    const rows = await this.prisma.hlmResidence.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async deleteResidence(id: string): Promise<{ removed: boolean }> {
    await this.ensureResidence(id);
    await this.prisma.hlmResidence.delete({ where: { id } });
    return { removed: true };
  }

  private async ensureResidence(id: string): Promise<HlmResidence> {
    const r = await this.prisma.hlmResidence.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`Résidence introuvable`);
    return r;
  }

  private toDto(r: HlmResidence): HlmResidenceDto {
    const warranty: WarrantyDatesDto = {
      deliveryDateIso: r.deliveryDate.toISOString().slice(0, 10),
      gpaEndDateIso: r.gpaEndDate.toISOString().slice(0, 10),
      biennaleEndDateIso: r.biennaleEndDate.toISOString().slice(0, 10),
      decennaleEndDateIso: r.decennaleEndDate.toISOString().slice(0, 10),
    };
    return {
      reference: r.id,
      name: r.name,
      bailleurReference: r.bailleurId,
      constructionYear: r.constructionYear ?? undefined,
      deliveryDateIso: r.deliveryDate.toISOString().slice(0, 10),
      residenceNeuve: r.residenceNeuve,
      hasInternalGPAServicePerResidence: r.hasInternalGPAServicePerResidence,
      warranty,
      createdAtIso: r.createdAt.toISOString(),
      updatedAtIso: r.updatedAt.toISOString(),
    };
  }
}
