import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { GrockJournalRow } from './grock-quality-probes';

/**
 * Étage 1 de la boucle d'apprentissage — JOURNAL DE DÉCISION.
 *
 * On persiste chaque tour Grock HORS session, pour alimenter plus tard les
 * sondes de qualité (variance au cadrage, fuite, dégénérescence…) et le banc de
 * non-régression. Ce journal est en ÉCRITURE SEULE côté runtime : il n'est
 * jamais relu pour influencer le raisonnement d'un ticket. NuclearFlush reste
 * donc intact — l'apprentissage passe uniquement par la doctrine signée.
 *
 * L'écriture est « best-effort » : un échec de journalisation ne doit jamais
 * casser le tour du locataire.
 */
export interface GrockDecisionRecord {
  ticketId?: string | null;
  photoHash?: string | null;
  title?: string | null;
  description?: string | null;
  tenantMessage?: string | null;
  perception?: string | null;
  state?: string | null;
  responsibility?: string | null;
  acknowledgment?: string | null;
  noteInterne?: string | null;
  model?: string | null;
  visionModel?: string | null;
}

@Injectable()
export class GrockDecisionJournalService {
  private readonly logger = new Logger(GrockDecisionJournalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Empreinte stable d'une photo (clé de corrélation pour la sonde
   * « variance au cadrage » : regrouper les tours portant la même image).
   */
  static hashImage(base64: string | undefined | null): string | null {
    const value = base64?.trim();
    if (!value) return null;
    return createHash('sha256')
      .update(Buffer.from(value, 'base64'))
      .digest('hex')
      .slice(0, 16);
  }

  async record(entry: GrockDecisionRecord): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "grock_decision_journal" (
          "ticketId",
          "photoHash",
          "title",
          "description",
          "tenantMessage",
          "perception",
          "state",
          "responsibility",
          "acknowledgment",
          "noteInterne",
          "model",
          "visionModel"
        )
        VALUES (
          ${entry.ticketId ?? null},
          ${entry.photoHash ?? null},
          ${entry.title ?? null},
          ${entry.description ?? null},
          ${entry.tenantMessage ?? null},
          ${entry.perception ?? null},
          ${entry.state ?? null},
          ${entry.responsibility ?? null},
          ${entry.acknowledgment ?? null},
          ${entry.noteInterne ?? null},
          ${entry.model ?? null},
          ${entry.visionModel ?? null}
        )
      `;
    } catch (e) {
      // Journal non bloquant : on n'interrompt jamais le tour locataire.
      this.logger.warn('[Grock] Journalisation de décision impossible', e);
    }
  }

  /**
   * Lecture pour analyse offline (sondes de qualité, étage 2). Purement en
   * lecture : n'influence jamais un tour locataire.
   */
  async loadForAnalysis(limit = 500): Promise<GrockJournalRow[]> {
    try {
      return await this.prisma.$queryRaw<GrockJournalRow[]>`
        SELECT
          "id", "photoHash", "title", "description", "tenantMessage",
          "perception", "state", "responsibility", "acknowledgment",
          "noteInterne", "model", "visionModel", "createdAt"
        FROM "grock_decision_journal"
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
      `;
    } catch (e) {
      this.logger.warn('[Grock] Lecture du journal de décision impossible', e);
      return [];
    }
  }
}
