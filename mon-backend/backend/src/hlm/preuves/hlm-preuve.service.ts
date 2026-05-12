import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  HlmEntretienPreuve,
  HlmLogementEntretien,
  Prisma,
} from '@prisma/client';
import { EntretienPreuveStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SubmitProofInput, ValidateProofAiInput } from '../dto/hlm-input.dto';
import type { HlmEntretienPreuveDto } from '../dto/hlm-shared.dto';

@Injectable()
export class HlmPreuveService {
  constructor(private readonly prisma: PrismaService) {}

  async submitProof(
    logementEntretienId: string,
    dto: SubmitProofInput,
  ): Promise<HlmEntretienPreuveDto> {
    const plan = await this.prisma.hlmLogementEntretien.findUnique({
      where: { id: logementEntretienId },
      include: { logement: true },
    });
    if (!plan) throw new NotFoundException(`Plan d’entretien introuvable`);

    const p1 = dto.photo1Url?.trim();
    const p2 = dto.photo2Url?.trim();
    if (!p1 || !p2) {
      throw new BadRequestException(
        `Les deux photographies sont obligatoires (photo1Url, photo2Url)`,
      );
    }

    const checklist = dto.checklist ?? {};
    if (typeof checklist !== 'object' || checklist === null) {
      throw new BadRequestException(`Checklist JSON invalide`);
    }

    let locataireId: string | null = dto.locataireId ?? null;
    if (locataireId) {
      const loc = await this.prisma.hlmLocataire.findUnique({
        where: { id: locataireId },
      });
      if (!loc) throw new NotFoundException(`Locataire introuvable`);
    } else if (plan.logement.locataireId) {
      locataireId = plan.logement.locataireId;
    }

    const row = await this.prisma.hlmEntretienPreuve.create({
      data: {
        logementEntretienId,
        locataireId,
        checklist: checklist as Prisma.InputJsonValue,
        photo1Url: p1,
        photo2Url: p2,
        statut: EntretienPreuveStatut.SOUMISE,
      },
    });
    return this.toDto(row);
  }

  async validateProofByLandlord(
    preuveId: string,
    accepted: boolean,
  ): Promise<HlmEntretienPreuveDto> {
    await this.ensureProof(preuveId);
    const row = await this.prisma.hlmEntretienPreuve.update({
      where: { id: preuveId },
      data: {
        validatedByLandlord: accepted,
        landlordValidatedAt: new Date(),
        statut: accepted
          ? EntretienPreuveStatut.VALIDEE_BAILLEUR
          : EntretienPreuveStatut.REFUSEE_BAILLEUR,
      },
    });
    return this.toDto(row);
  }

  async validateProofByAI(
    preuveId: string,
    payload: ValidateProofAiInput,
  ): Promise<HlmEntretienPreuveDto> {
    await this.ensureProof(preuveId);
    const row = await this.prisma.hlmEntretienPreuve.update({
      where: { id: preuveId },
      data: {
        validatedByAI: payload.accepted,
        aiValidatedAt: new Date(),
        statut: payload.accepted
          ? EntretienPreuveStatut.VALIDEE_IA
          : EntretienPreuveStatut.REFUSEE_IA,
      },
    });
    return this.toDto(row);
  }

  async listProofsForLogement(
    logementId: string,
  ): Promise<HlmEntretienPreuveDto[]> {
    const logement = await this.prisma.hlmLogement.findUnique({
      where: { id: logementId },
    });
    if (!logement) throw new NotFoundException(`Logement introuvable`);

    const plans = await this.prisma.hlmLogementEntretien.findMany({
      where: { logementId },
      select: { id: true },
    });
    const ids = plans.map((p) => p.id);
    const rows = await this.prisma.hlmEntretienPreuve.findMany({
      where: { logementEntretienId: { in: ids } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  /** Preuve récente validée pour critères extérieurs (fenêtre 90 j). */
  async hasRecentValidatedOutdoorProof(logementId: string): Promise<boolean> {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const outdoorTypes = await this.prisma.hlmEntretienType.findMany({
      where: {
        OR: [
          { requiresOutdoorContext: true },
          {
            code: {
              in: [
                'EXT_COUR',
                'EXT_JARDIN',
                'EXT_TERRASSE',
                'EXT_PATIO',
                'EXTERIEUR_PRIVATIF',
              ],
            },
          },
        ],
      },
      select: { id: true },
    });
    const typeIds = outdoorTypes.map((t) => t.id);
    if (typeIds.length === 0) return false;

    const plans = await this.prisma.hlmLogementEntretien.findMany({
      where: { logementId, entretienTypeId: { in: typeIds } },
      select: { id: true },
    });
    const planIds = plans.map((p) => p.id);
    if (planIds.length === 0) return false;

    const ok = await this.prisma.hlmEntretienPreuve.findFirst({
      where: {
        logementEntretienId: { in: planIds },
        createdAt: { gte: since },
        OR: [{ validatedByLandlord: true }, { validatedByAI: true }],
      },
    });
    return !!ok;
  }

  private async ensureProof(id: string): Promise<HlmEntretienPreuve> {
    const p = await this.prisma.hlmEntretienPreuve.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`Preuve introuvable`);
    return p;
  }

  private toDto(r: HlmEntretienPreuve): HlmEntretienPreuveDto {
    const checklist =
      typeof r.checklist === 'object' && r.checklist !== null
        ? (r.checklist as Record<string, unknown>)
        : {};
    return {
      reference: r.id,
      logementEntretienReference: r.logementEntretienId,
      locataireReference: r.locataireId,
      checklist,
      photoAccessPrimary: r.photo1Url,
      photoAccessSecondary: r.photo2Url,
      validatedByAi: r.validatedByAI,
      validatedByLandlord: r.validatedByLandlord,
      statut: r.statut,
      landlordValidatedAtIso: r.landlordValidatedAt?.toISOString() ?? null,
      aiValidatedAtIso: r.aiValidatedAt?.toISOString() ?? null,
      createdAtIso: r.createdAt.toISOString(),
    };
  }
}
