import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  HlmEntretienType,
  HlmLogementEntretien,
} from '@prisma/client';
import { MaintenanceFrequency } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateEntretienTypeInput } from '../dto/hlm-input.dto';
import type {
  HlmEntretienTypeDto,
  HlmLogementEntretienDto,
} from '../dto/hlm-shared.dto';

function monthsForFrequency(f: MaintenanceFrequency): number {
  switch (f) {
    case MaintenanceFrequency.MENSUEL:
      return 1;
    case MaintenanceFrequency.TRIMESTRIEL:
      return 3;
    case MaintenanceFrequency.ANNUEL:
      return 12;
    default:
      return 12;
  }
}

function addMonths(d: Date, m: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

@Injectable()
export class HlmEntretienService {
  constructor(private readonly prisma: PrismaService) {}

  async listEntretienTypes(): Promise<HlmEntretienTypeDto[]> {
    const rows = await this.prisma.hlmEntretienType.findMany({
      orderBy: { labelFr: 'asc' },
    });
    return rows.map((r) => this.typeToDto(r));
  }

  async createEntretienType(
    dto: CreateEntretienTypeInput,
  ): Promise<HlmEntretienTypeDto> {
    try {
      const row = await this.prisma.hlmEntretienType.create({
        data: {
          code: dto.code,
          labelFr: dto.labelFr,
          description: dto.description ?? null,
          frequency: dto.frequency,
          requiresOutdoorContext: dto.requiresOutdoorContext ?? false,
        },
      });
      return this.typeToDto(row);
    } catch {
      throw new BadRequestException(
        `Impossible de créer le type (code déjà utilisé ou données invalides)`,
      );
    }
  }

  async assignEntretienToLogement(
    logementId: string,
    entretienTypeId: string,
  ): Promise<HlmLogementEntretienDto> {
    await this.ensureLogement(logementId);
    const t = await this.prisma.hlmEntretienType.findUnique({
      where: { id: entretienTypeId },
    });
    if (!t) throw new NotFoundException(`Type d’entretien introuvable`);
    const nextDue = addMonths(new Date(), monthsForFrequency(t.frequency));
    const row = await this.prisma.hlmLogementEntretien.upsert({
      where: {
        logementId_entretienTypeId: { logementId, entretienTypeId },
      },
      create: {
        logementId,
        entretienTypeId,
        active: true,
        nextDueAt: nextDue,
      },
      update: {
        active: true,
        nextDueAt: nextDue,
      },
      include: { entretienType: true },
    });
    return this.planToDto(row);
  }

  async getLogementEntretien(
    logementId: string,
  ): Promise<HlmLogementEntretienDto[]> {
    await this.ensureLogement(logementId);
    const rows = await this.prisma.hlmLogementEntretien.findMany({
      where: { logementId },
      include: { entretienType: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.planToDto(r));
  }

  async updateNextReminder(logementEntretienId: string): Promise<HlmLogementEntretienDto> {
    const plan = await this.prisma.hlmLogementEntretien.findUnique({
      where: { id: logementEntretienId },
      include: { entretienType: true },
    });
    if (!plan) throw new NotFoundException(`Plan d’entretien introuvable`);
    const base = plan.lastCompletedAt ?? new Date();
    const next = addMonths(
      base,
      monthsForFrequency(plan.entretienType.frequency),
    );
    const updated = await this.prisma.hlmLogementEntretien.update({
      where: { id: logementEntretienId },
      data: { nextDueAt: next },
      include: { entretienType: true },
    });
    return this.planToDto(updated);
  }

  async markAsDone(logementEntretienId: string): Promise<HlmLogementEntretienDto> {
    const plan = await this.prisma.hlmLogementEntretien.findUnique({
      where: { id: logementEntretienId },
      include: { entretienType: true },
    });
    if (!plan) throw new NotFoundException(`Plan d’entretien introuvable`);
    const doneAt = new Date();
    const next = addMonths(
      doneAt,
      monthsForFrequency(plan.entretienType.frequency),
    );
    const updated = await this.prisma.hlmLogementEntretien.update({
      where: { id: logementEntretienId },
      data: {
        lastCompletedAt: doneAt,
        nextDueAt: next,
      },
      include: { entretienType: true },
    });
    return this.planToDto(updated);
  }

  private async ensureLogement(logementId: string): Promise<void> {
    const l = await this.prisma.hlmLogement.findUnique({
      where: { id: logementId },
    });
    if (!l) throw new NotFoundException(`Logement introuvable`);
  }

  private typeToDto(r: HlmEntretienType): HlmEntretienTypeDto {
    return {
      reference: r.id,
      code: r.code,
      labelFr: r.labelFr,
      description: r.description,
      frequency: r.frequency,
      requiresOutdoorContext: r.requiresOutdoorContext,
    };
  }

  private planToDto(
    r: HlmLogementEntretien & { entretienType: HlmEntretienType },
  ): HlmLogementEntretienDto {
    return {
      reference: r.id,
      logementReference: r.logementId,
      entretienTypeReference: r.entretienTypeId,
      code: r.entretienType.code,
      active: r.active,
      nextDueAtIso: r.nextDueAt?.toISOString() ?? null,
      lastCompletedAtIso: r.lastCompletedAt?.toISOString() ?? null,
    };
  }
}
