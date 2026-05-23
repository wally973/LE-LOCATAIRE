import { Injectable, Optional } from '@nestjs/common';
import { AiMemoryKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LegalReferencesService } from '../legal-references/legal-references.service';

export interface AiMemoryChunk {
  id: number;
  kind: AiMemoryKind;
  title: string;
  content: string;
  score: number;
}

/**
 * RAG léger (Sprint G) — recherche par mots-clés dans AiMemory.
 * Remplaçable plus tard par embeddings / pgvector.
 */
@Injectable()
export class AiMemoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly legalRefs?: LegalReferencesService,
  ) {}

  async searchRelevant(params: {
    landlordProfileId?: number;
    housingId?: number;
    query: string;
    limit?: number;
  }): Promise<AiMemoryChunk[]> {
    const limit = params.limit ?? 5;
    const query = params.query.toLowerCase();
    const tokens = query
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2);

    const landlordWhere = params.landlordProfileId
      ? {
          OR: [
            { landlordProfileId: params.landlordProfileId },
            { landlordProfileId: null },
          ],
        }
      : { landlordProfileId: null };

    const housingWhere = params.housingId
      ? {
          OR: [{ housingId: params.housingId }, { housingId: null }],
        }
      : { housingId: null };

    const rows = await this.prisma.aiMemory.findMany({
      where: { AND: [landlordWhere, housingWhere] },
      orderBy: { updatedAt: 'desc' },
      take: 80,
    });

    const scored = rows.map((row) => {
      const hay = `${row.title} ${row.content}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) score += 2;
      }
      if (row.landlordProfileId === params.landlordProfileId) score += 1;
      if (row.housingId === params.housingId) score += 2;
      return { ...row, score };
    });

    const memoryHits = scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ id, kind, title, content, score }) => ({
        id,
        kind,
        title,
        content,
        score,
      }));

    if (!this.legalRefs || memoryHits.length >= limit) {
      return memoryHits;
    }

    const legalHits = await this.legalRefs.search({
      query: params.query,
      limit: limit - memoryHits.length,
    });
    const legalAsMemory: AiMemoryChunk[] = legalHits.map((h, idx) => ({
      id: -(idx + 1),
      kind: 'FAQ_BAILLEUR' as AiMemoryKind,
      title: h.title,
      content: `${h.summary}\n\n${h.content}`,
      score: h.score,
    }));

    return [...memoryHits, ...legalAsMemory]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  formatForPrompt(chunks: AiMemoryChunk[]): string {
    if (chunks.length === 0) {
      return 'Aucun extrait réglementaire spécifique — appliquer le droit locatif français classique.';
    }
    return chunks
      .map(
        (c, i) =>
          `[${i + 1}] (${c.kind}) ${c.title}\n${c.content.slice(0, 1200)}`,
      )
      .join('\n\n');
  }
}
