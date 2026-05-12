import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntretienTypeCode, HlmLogement } from '@prisma/client';
import { MaintenanceFrequency } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateLogementInput,
  UpdateLogementInput,
} from '../dto/hlm-input.dto';
import type { HlmLogementDto } from '../dto/hlm-shared.dto';

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
export class HlmLogementService {
  constructor(private readonly prisma: PrismaService) {}

  async createLogement(dto: CreateLogementInput): Promise<HlmLogementDto> {
    const res = await this.prisma.hlmResidence.findUnique({
      where: { id: dto.residenceId },
    });
    if (!res) throw new NotFoundException(`Résidence introuvable`);
    const row = await this.prisma.hlmLogement.create({
      data: {
        residenceId: dto.residenceId,
        label: dto.label,
        externalRef: dto.externalRef ?? null,
        hasVmc: dto.hasVmc ?? false,
        hasSolarWaterHeater: dto.hasSolarWaterHeater ?? false,
        hasCour: dto.hasCour ?? false,
        hasJardin: dto.hasJardin ?? false,
        hasTerrasse: dto.hasTerrasse ?? false,
        hasPatio: dto.hasPatio ?? false,
      },
    });
    return this.toDto(row);
  }

  async updateLogement(
    id: string,
    dto: UpdateLogementInput,
  ): Promise<HlmLogementDto> {
    await this.ensureLogement(id);
    const row = await this.prisma.hlmLogement.update({
      where: { id },
      data: {
        label: dto.label,
        externalRef: dto.externalRef,
        hasVmc: dto.hasVmc,
        hasSolarWaterHeater: dto.hasSolarWaterHeater,
        hasCour: dto.hasCour,
        hasJardin: dto.hasJardin,
        hasTerrasse: dto.hasTerrasse,
        hasPatio: dto.hasPatio,
      },
    });
    return this.toDto(row);
  }

  async getLogement(id: string): Promise<HlmLogementDto> {
    const row = await this.prisma.hlmLogement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Logement introuvable`);
    return this.toDto(row);
  }

  async listLogementsByResidence(residenceId: string): Promise<HlmLogementDto[]> {
    const exists = await this.prisma.hlmResidence.findUnique({
      where: { id: residenceId },
    });
    if (!exists) throw new NotFoundException(`Résidence introuvable`);
    const rows = await this.prisma.hlmLogement.findMany({
      where: { residenceId },
      orderBy: { label: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  /** Liste tous les logements patrimoine HLM (filtres à ajouter au besoin). */
  async listAllLogements(): Promise<HlmLogementDto[]> {
    const rows = await this.prisma.hlmLogement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async assignLocataire(
    logementId: string,
    locataireId: string,
  ): Promise<HlmLogementDto> {
    await this.ensureLogement(logementId);
    const loc = await this.prisma.hlmLocataire.findUnique({
      where: { id: locataireId },
    });
    if (!loc) throw new NotFoundException(`Locataire introuvable`);
    const row = await this.prisma.hlmLogement.update({
      where: { id: logementId },
      data: { locataireId },
    });
    return this.toDto(row);
  }

  async unassignLocataire(logementId: string): Promise<HlmLogementDto> {
    await this.ensureLogement(logementId);
    const row = await this.prisma.hlmLogement.update({
      where: { id: logementId },
      data: { locataireId: null },
    });
    return this.toDto(row);
  }

  /**
   * Crée les lignes HlmLogementEntretien selon les équipements déclarés.
   * Requiert un catalogue HlmEntretienType préalablement peuplé.
   */
  async initEntretienPlan(logementId: string): Promise<{ created: number }> {
    const logement = await this.prisma.hlmLogement.findUnique({
      where: { id: logementId },
    });
    if (!logement) throw new NotFoundException(`Logement introuvable`);

    const codes = this.resolveCodesForEquipment(logement);
    if (codes.length === 0) {
      throw new BadRequestException(
        `Aucun équipement déclaré : impossible d’initialiser un plan d’entretien`,
      );
    }

    const types = await this.prisma.hlmEntretienType.findMany({
      where: { code: { in: codes } },
    });
    if (types.length === 0) {
      throw new BadRequestException(
        `Catalogue EntretienType vide ou incomplet pour les codes : ${codes.join(', ')}`,
      );
    }

    const now = new Date();
    let created = 0;
    for (const t of types) {
      const nextDue = addMonths(now, monthsForFrequency(t.frequency));
      await this.prisma.hlmLogementEntretien.upsert({
        where: {
          logementId_entretienTypeId: {
            logementId,
            entretienTypeId: t.id,
          },
        },
        create: {
          logementId,
          entretienTypeId: t.id,
          active: true,
          nextDueAt: nextDue,
        },
        update: {
          active: true,
          nextDueAt: nextDue,
        },
      });
      created += 1;
    }
    return { created };
  }

  private resolveCodesForEquipment(l: HlmLogement): EntretienTypeCode[] {
    const codes: EntretienTypeCode[] = [];
    if (l.hasVmc) codes.push('VMC');
    if (l.hasSolarWaterHeater) codes.push('CHAUFFE_EAU_SOLAIRE');
    const ext =
      l.hasCour || l.hasJardin || l.hasTerrasse || l.hasPatio;
    if (ext) {
      if (l.hasCour) codes.push('EXT_COUR');
      if (l.hasJardin) codes.push('EXT_JARDIN');
      if (l.hasTerrasse) codes.push('EXT_TERRASSE');
      if (l.hasPatio) codes.push('EXT_PATIO');
      if (
        codes.filter((c) => c.startsWith('EXT_')).length === 0
      ) {
        codes.push('EXTERIEUR_PRIVATIF');
      }
    }
    return [...new Set(codes)];
  }

  private async ensureLogement(id: string): Promise<HlmLogement> {
    const l = await this.prisma.hlmLogement.findUnique({ where: { id } });
    if (!l) throw new NotFoundException(`Logement introuvable`);
    return l;
  }

  private toDto(r: HlmLogement): HlmLogementDto {
    return {
      reference: r.id,
      label: r.label,
      externalRef: r.externalRef,
      residenceReference: r.residenceId,
      hasVmc: r.hasVmc,
      hasSolarWaterHeater: r.hasSolarWaterHeater,
      hasCour: r.hasCour,
      hasJardin: r.hasJardin,
      hasTerrasse: r.hasTerrasse,
      hasPatio: r.hasPatio,
      locataireReference: r.locataireId,
      createdAtIso: r.createdAt.toISOString(),
      updatedAtIso: r.updatedAt.toISOString(),
    };
  }
}
