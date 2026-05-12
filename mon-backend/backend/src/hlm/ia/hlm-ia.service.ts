import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { HlmIAResult } from '@prisma/client';
import { HlmIAResultKind } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SaveIAResultInput } from '../dto/hlm-input.dto';
import type { HlmIAResultDto } from '../dto/hlm-shared.dto';
import { HlmTicketService } from '../tickets/hlm-ticket.service';

@Injectable()
export class HlmIAService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketService: HlmTicketService,
  ) {}

  /** Placeholder analyse image — persiste un résultat minimal ; brancher pipeline ML plus tard. */
  async analyzeImage(preuveId: string): Promise<HlmIAResultDto> {
    await this.ensureProof(preuveId);
    const row = await this.prisma.hlmIAResult.create({
      data: {
        kind: HlmIAResultKind.ANALYSE_IMAGE,
        entretienPreuveId: preuveId,
        imageAnalysis: {
          status: 'pending_integration',
          message:
            'Brancher le service d’analyse d’images (bucket Supabase + modèle)',
        },
        confidence: null,
      },
    });
    return this.toDto(row);
  }

  /** Synthèse diagnostic pour ticket HLM (stub structuré). */
  async diagnosticTicket(ticketId: string): Promise<HlmIAResultDto> {
    await this.ensureTicket(ticketId);
    const row = await this.prisma.hlmIAResult.create({
      data: {
        kind: HlmIAResultKind.DIAGNOSTIC_ENTRETIEN,
        ticketId,
        diagnostic: {
          status: 'heuristic',
          message:
            'Compléter avec règles métier et historique entretiens / garanties.',
        },
        confidence: 0.5,
      },
    });
    return this.toDto(row);
  }

  /** Recalcule le routage via le service ticket et enregistre la proposition IA. */
  async computeRouting(ticketId: string): Promise<HlmIAResultDto> {
    const dto = await this.ticketService.routeTicket(ticketId);
    const ticket = await this.prisma.hlmTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException(`Ticket introuvable`);

    const row = await this.prisma.hlmIAResult.create({
      data: {
        kind: HlmIAResultKind.ROUTAGE_TICKET,
        ticketId,
        routingIA: {
          routingTarget: dto.routingTarget,
          warrantyPhase: dto.warrantyPhase,
        },
        confidence: 0.85,
      },
    });
    return this.toDto(row);
  }

  async saveIAResult(input: SaveIAResultInput): Promise<HlmIAResultDto> {
    if (!input.ticketId && !input.entretienPreuveId) {
      throw new BadRequestException(
        `Au moins ticketId ou entretienPreuveId est requis`,
      );
    }
    const row = await this.prisma.hlmIAResult.create({
      data: {
        kind: input.kind,
        imageAnalysis: toJson(input.imageAnalysis),
        diagnostic: toJson(input.diagnostic),
        routingIA: toJson(input.routingIA),
        confidence: input.confidence ?? undefined,
        ticketId: input.ticketId ?? undefined,
        entretienPreuveId: input.entretienPreuveId ?? undefined,
        modelVersion: input.modelVersion ?? undefined,
      },
    });
    return this.toDto(row);
  }

  private async ensureProof(id: string): Promise<void> {
    const p = await this.prisma.hlmEntretienPreuve.findUnique({
      where: { id },
    });
    if (!p) throw new NotFoundException(`Preuve introuvable`);
  }

  private async ensureTicket(id: string): Promise<void> {
    const t = await this.prisma.hlmTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException(`Ticket introuvable`);
  }

  private toDto(r: HlmIAResult): HlmIAResultDto {
    return {
      reference: r.id,
      kind: r.kind,
      imageAnalysis: r.imageAnalysis as Record<string, unknown> | null,
      diagnostic: r.diagnostic as Record<string, unknown> | null,
      routingSuggestion: r.routingIA as Record<string, unknown> | null,
      confidence: r.confidence,
      ticketReference: r.ticketId,
      proofReference: r.entretienPreuveId,
      modelVersion: r.modelVersion,
      createdAtIso: r.createdAt.toISOString(),
    };
  }
}

function toJson(
  v: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return v as Prisma.InputJsonValue;
}
