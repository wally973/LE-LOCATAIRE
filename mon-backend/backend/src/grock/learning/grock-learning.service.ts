import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GrockService, type GrockChatMessage, type GrockTurnResult } from '../grock.service';
import { GrockDecisionJournalService } from './grock-decision-journal.service';
import {
  runQualityProbes,
  type GrockLessonCandidate,
} from './grock-quality-probes';
import {
  readGrockLedgerFresh,
  type GrockDeductionPrinciple,
} from '../grock-deduction-ledger';
import {
  appendDraftLesson,
  rejectLesson,
  signLesson,
  type ProposeLessonInput,
} from './grock-doctrine-writer';

/**
 * Étage 3 — ARBITRAGE HUMAIN.
 *
 * Orchestration : lister les cas détectés (étage 2), et transformer un cas en
 * leçon de doctrine sous contrôle humain (proposer `draft` → signer `validated`
 * → rejeter). Aucune décision automatique : l'humain tranche toujours.
 */
@Injectable()
export class GrockLearningService {
  constructor(
    private readonly journal: GrockDecisionJournalService,
    private readonly grock: GrockService,
  ) {}

  /** Contexte journal + sondes + derniers PreprocessedSignal pour dialogue admin. */
  private async buildAdminContext(): Promise<string> {
    const rows = await this.journal.loadForAnalysis(200);
    const { analyzed, byKind, candidates } = await this.listCandidates(200);
    const ledger = readGrockLedgerFresh();
    const validated = ledger.principles.filter((p) => p.status === 'validated').length;
    const drafts = ledger.principles.filter((p) => p.status === 'draft').length;
    const lowSignal = rows.filter((r) => r.signalQuality != null && r.signalQuality < 4).length;
    const lines = [
      `Journal de décision : ${rows.length} tours chargés (fenêtre analyse : ${analyzed}).`,
      `Tours signalQuality < 4 : ${lowSignal}.`,
      `Leçons doctrine : ${validated} validées, ${drafts} brouillon.`,
      `Sondes actives : ${Object.entries(byKind)
        .map(([k, n]) => `${k}=${n}`)
        .join(', ') || 'aucun cas'}.`,
    ];
    if (candidates.length) {
      lines.push('Cas récents à arbitrer (résumé) :');
      for (const c of candidates.slice(0, 5)) {
        lines.push(`- [${c.kind}] ${c.summary}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Conversation Architecte ↔ Grock — même moteur (5 têtes), interlocuteur admin.
   * Permet questions gouvernance, stats, « pourquoi n’as-tu pas signalé… ».
   */
  async converseAsAdmin(params: {
    message: string;
    title?: string;
    description?: string;
    sessionMessages?: GrockChatMessage[];
  }): Promise<GrockTurnResult> {
    const msg = params.message?.trim();
    if (!msg) throw new BadRequestException('Message requis.');
    const adminContext = await this.buildAdminContext();
    return this.grock.runTurn({
      tenantFirstName: '',
      title: params.title?.trim() || 'Dialogue administration Grock',
      description:
        params.description?.trim() ||
        'Échange Architecte : gouvernance, qualité, statistiques, explication des décisions.',
      ticketHistory: [],
      sessionMessages: params.sessionMessages ?? [],
      tenantMessage: msg,
      mode: 'tenant_turn',
      interlocutor: 'admin',
      adminContext,
    });
  }

  /** File des cas à arbitrer, produite par les sondes de qualité. */
  async listCandidates(limit = 500): Promise<{
    analyzed: number;
    byKind: Record<string, number>;
    candidates: GrockLessonCandidate[];
  }> {
    const rows = await this.journal.loadForAnalysis(limit);
    const candidates = runQualityProbes(rows);
    const byKind = candidates.reduce<Record<string, number>>((acc, c) => {
      acc[c.kind] = (acc[c.kind] ?? 0) + 1;
      return acc;
    }, {});
    return { analyzed: rows.length, byKind, candidates };
  }

  /** Registre de doctrine (leçons draft + validated). */
  listLessons(status?: 'draft' | 'validated'): {
    version: number;
    updatedAt: string;
    principles: GrockDeductionPrinciple[];
  } {
    const ledger = readGrockLedgerFresh();
    const principles = status
      ? ledger.principles.filter((p) => p.status === status)
      : ledger.principles;
    return {
      version: ledger.version,
      updatedAt: ledger.updatedAt,
      principles,
    };
  }

  proposeLesson(input: ProposeLessonInput): GrockDeductionPrinciple {
    try {
      return appendDraftLesson(input);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  signLesson(id: string, signataire: string): GrockDeductionPrinciple {
    try {
      return signLesson(id, signataire);
    } catch (e) {
      throw new NotFoundException((e as Error).message);
    }
  }

  rejectLesson(id: string): { ok: true; id: string } {
    try {
      return rejectLesson(id);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
}
