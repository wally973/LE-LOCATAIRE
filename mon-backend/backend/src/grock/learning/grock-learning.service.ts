import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
  constructor(private readonly journal: GrockDecisionJournalService) {}

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
