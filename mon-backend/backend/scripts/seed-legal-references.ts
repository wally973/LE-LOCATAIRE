/**
 * Charge data/legal-references.json dans la table LegalReference (+ AiMemory global).
 *   npx ts-node scripts/seed-legal-references.ts
 */
import {
  AiMemoryKind,
  LegalReferenceKind,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { loadLegalReferencesCatalogFromFile } from '../src/legal-references/legal-reference.loader';

const prisma = new PrismaClient();

function mapKindToAiMemory(kind: string): AiMemoryKind {
  if (kind === 'DECRET' || kind === 'LOI' || kind === 'CODE_CIVIL' || kind === 'ARRETE') {
    return 'DECRET';
  }
  if (kind === 'FICHE_METIER') {
    return 'RESIDENCE_ARCHIVE';
  }
  return 'FAQ_BAILLEUR';
}

async function main() {
  const catalog = loadLegalReferencesCatalogFromFile();
  console.log(
    `Catalogue v${catalog.version} (${catalog.updatedAt}) — ${catalog.entries.length} entrées`,
  );

  for (const entry of catalog.entries) {
    await prisma.legalReference.upsert({
      where: { slug: entry.slug },
      create: {
        slug: entry.slug,
        version: catalog.version,
        kind: entry.kind as LegalReferenceKind,
        category: entry.category,
        title: entry.title,
        summary: entry.summary,
        content: entry.content,
        responsibilityHint: entry.responsibilityHint,
        keywords: entry.keywords,
        sources: entry.sources as unknown as Prisma.InputJsonValue,
        exceptions: entry.exceptions,
        sortOrder: entry.sortOrder,
      },
      update: {
        version: catalog.version,
        kind: entry.kind as LegalReferenceKind,
        category: entry.category,
        title: entry.title,
        summary: entry.summary,
        content: entry.content,
        responsibilityHint: entry.responsibilityHint,
        keywords: entry.keywords,
        sources: entry.sources as unknown as Prisma.InputJsonValue,
        exceptions: entry.exceptions,
        sortOrder: entry.sortOrder,
      },
    });
    console.log(`OK   LegalReference ${entry.slug}`);

    const aiKind = mapKindToAiMemory(entry.kind);
    const aiTitle = `[${entry.category}] ${entry.title}`;
    const aiContent = `${entry.summary}\n\n${entry.content}`;
    const existing = await prisma.aiMemory.findFirst({
      where: { landlordProfileId: null, title: aiTitle },
    });
    if (existing) {
      await prisma.aiMemory.update({
        where: { id: existing.id },
        data: { content: aiContent, kind: aiKind },
      });
    } else {
      await prisma.aiMemory.create({
        data: {
          landlordProfileId: null,
          kind: aiKind,
          title: aiTitle,
          content: aiContent,
        },
      });
    }
  }

  console.log(`\nTerminé : ${catalog.entries.length} références juridiques.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
