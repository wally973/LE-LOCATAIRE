import { Injectable } from '@nestjs/common';
import { LegalReferenceKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  LegalReferenceEntryDto,
  LegalReferenceSearchHitDto,
  LegalReferencesCatalogDto,
} from './legal-reference.types';
import { loadLegalReferencesCatalogFromFile } from './legal-reference.loader';

@Injectable()
export class LegalReferencesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catalogue complet (pour sync mobile). */
  async getCatalog(): Promise<LegalReferencesCatalogDto> {
    const rows = await this.prisma.legalReference.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    if (rows.length === 0) {
      return loadLegalReferencesCatalogFromFile();
    }
    const meta = await this.getVersionMeta();
    return {
      version: meta.version,
      updatedAt: meta.updatedAt,
      entries: rows.map((r) => this.toDto(r)),
    };
  }

  async getVersionMeta(): Promise<{ version: number; updatedAt: string; count: number }> {
    const count = await this.prisma.legalReference.count();
    if (count === 0) {
      const file = loadLegalReferencesCatalogFromFile();
      return {
        version: file.version,
        updatedAt: file.updatedAt,
        count: file.entries.length,
      };
    }
    const latest = await this.prisma.legalReference.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true, version: true },
    });
    return {
      version: latest?.version ?? 1,
      updatedAt: (latest?.updatedAt ?? new Date()).toISOString().slice(0, 10),
      count,
    };
  }

  /** Recherche locale par mots-clés (offline-friendly, même algo que AiMemory). */
  async search(params: {
    query: string;
    category?: string;
    limit?: number;
  }): Promise<LegalReferenceSearchHitDto[]> {
    const limit = params.limit ?? 8;
    const tokens = params.query
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2);

    const where: Prisma.LegalReferenceWhereInput = {};
    if (params.category) {
      where.category = params.category;
    }

    const rows = await this.prisma.legalReference.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });

    let candidates = rows;
    if (candidates.length === 0) {
      const file = loadLegalReferencesCatalogFromFile();
      candidates = file.entries.map((e) => ({
        slug: e.slug,
        version: file.version,
        kind: e.kind as LegalReferenceKind,
        category: e.category,
        title: e.title,
        summary: e.summary,
        content: e.content,
        responsibilityHint: e.responsibilityHint,
        keywords: e.keywords,
        sources: e.sources as unknown as Prisma.JsonValue,
        exceptions: e.exceptions,
        sortOrder: e.sortOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }

    const scored = candidates.map((row) => {
      const kw = row.keywords.join(' ');
      const hay =
        `${row.title} ${row.summary} ${row.content} ${kw} ${row.category}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) score += 2;
      }
      if (params.category && row.category === params.category) score += 3;
      return { row, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row, score }) => ({
        ...this.toDto(row),
        score,
      }));
  }

  formatForPrompt(hits: LegalReferenceSearchHitDto[]): string {
    if (hits.length === 0) {
      return '';
    }
    return hits
      .map(
        (h, i) =>
          `[J${i + 1}] (${h.kind}/${h.category}) ${h.title}\n${h.summary}\n${h.content.slice(0, 900)}`,
      )
      .join('\n\n');
  }

  private toDto(row: {
    slug: string;
    kind: LegalReferenceKind;
    category: string;
    title: string;
    summary: string;
    content: string;
    responsibilityHint: string | null;
    keywords: string[];
    sources: Prisma.JsonValue;
    exceptions: string[];
    sortOrder: number;
  }): LegalReferenceEntryDto {
    return {
      slug: row.slug,
      kind: row.kind,
      category: row.category,
      title: row.title,
      summary: row.summary,
      content: row.content,
      responsibilityHint: row.responsibilityHint,
      keywords: row.keywords,
      sources: row.sources as unknown as LegalReferenceEntryDto['sources'],
      exceptions: row.exceptions,
      sortOrder: row.sortOrder,
    };
  }
}
