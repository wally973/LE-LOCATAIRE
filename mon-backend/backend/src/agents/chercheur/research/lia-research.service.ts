import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseIntakeState,
  buildIntakeSummary,
  mergeAiLastDecision,
} from './lia-intake.service';
import { parseCompanionState } from './lia-companion.types';
import { loadPathologyIndex } from './knowledge-index.loader';
import {
  buildDiagnosticState,
  formatDiagnosticStateBrief,
} from './lia-diagnostic-state';
import { parseDiagnosticState } from './lia-diagnostic-state.types';
import {
  formatOccupancyContextBrief,
  parseOccupancyContext,
} from './lia-occupancy-context';
import { LiaHousingWarrantyService } from './lia-housing-warranty';
import { formatInstallationsBrief } from './installations-charges.loader';

/** Auto-recherche interne V1 — bibliothécaire AFPOLS/AQC + tickets similaires (Q42, Q55). */
@Injectable()
export class LiaResearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly housingWarranty: LiaHousingWarrantyService,
  ) {}

  private static readonly FICHES: Record<string, string> = {
    PLUMBING:
      'Fuite / eau : vérifier arrivée générale, organes accessibles, photos du point de fuite.',
    ELECTRICITY:
      'Électricité : couper le circuit concerné (DPN) avant photo ; prise/tableau — risque incendie si fils visibles.',
    HUMIDITY:
      'Humidité : différencier infiltration, remontée capillaire, condensation — signes odeur/couleur/texture.',
    ROOF: 'Toiture : localiser infiltration, pièce sous dalle, photos intérieur/extérieur si possible.',
    GENERIC: 'Signalement général : préciser pièce, depuis quand, évolution.',
  };

  async buildInternalBrief(ticketId: number): Promise<string> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { documents: true },
    });
    if (!ticket) return '';

    const intake = parseIntakeState(ticket.aiLastDecision);
    const category = intake?.category ?? ticket.aiCategory ?? 'GENERIC';
    const fiche = LiaResearchService.FICHES[category] ?? LiaResearchService.FICHES.GENERIC;
    const intakeSummary = intake ? buildIntakeSummary(intake) : '';
    const companion = parseCompanionState(ticket.aiLastDecision);
    const searchLine = companion?.search_trigger
      ? `Recherche technique demandée : ${companion.search_trigger}`
      : '';

    const contextText = [
      ticket.title,
      ticket.description,
      intakeSummary,
    ]
      .filter(Boolean)
      .join('\n');

    const occupancyCtx = parseOccupancyContext(contextText);
    let warrantyBlock = '';
    try {
      warrantyBlock = await this.housingWarranty.buildWarrantyBlock(
        ticket.housingId,
      );
    } catch {
      warrantyBlock = '';
    }
    const occupancyBlock = formatOccupancyContextBrief(
      occupancyCtx,
      warrantyBlock,
    );

    const installationsBlock = formatInstallationsBrief(contextText);

    let librarianBlock = '';
    try {
      loadPathologyIndex();
      const existing = parseDiagnosticState(ticket.aiLastDecision);
      const diagnostic = buildDiagnosticState({
        category: String(category),
        contextText,
        existing,
        intakeAnswers: intake?.answers,
      });
      librarianBlock = formatDiagnosticStateBrief(diagnostic);
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          aiLastDecision: mergeAiLastDecision(ticket.aiLastDecision, {
            diagnostic,
          }) as object,
        },
      });
    } catch {
      librarianBlock =
        'Bibliothèque pathologies : index knowledge/pathology-index.json indisponible.';
    }

    const word = ticket.title.trim().split(/\s+/)[0];
    const similar = await this.prisma.ticket.findMany({
      where: {
        id: { not: ticketId },
        ...(ticket.landlordProfileId
          ? { landlordProfileId: ticket.landlordProfileId }
          : {}),
        ...(ticket.aiCategory
          ? { aiCategory: ticket.aiCategory }
          : word.length > 2
            ? { title: { contains: word, mode: 'insensitive' } }
            : {}),
        responsibility: { not: 'PENDING' },
      },
      take: 3,
      orderBy: { updatedAt: 'desc' },
      select: {
        caseNumber: true,
        responsibility: true,
        status: true,
        title: true,
      },
    });

    const similarLines =
      similar.length === 0
        ? 'Aucune affaire résolue similaire récente.'
        : similar
            .map(
              (t) =>
                `- ${t.caseNumber ?? '?'} : ${t.title} → ${t.responsibility} (${t.status})`,
            )
            .join('\n');

    return [
      '=== Recherche interne (V1) — bibliothécaire ===',
      `Fiche métier (${category}) : ${fiche}`,
      intakeSummary ? `Constat intake : ${intakeSummary}` : '',
      searchLine,
      occupancyBlock,
      installationsBlock,
      librarianBlock,
      `Affaires proches :\n${similarLines}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
