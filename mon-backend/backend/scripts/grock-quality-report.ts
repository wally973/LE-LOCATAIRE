/**
 * Rapport des sondes de qualité Grock (étage 2 de la boucle d'apprentissage).
 *
 * Lit le journal de décision (grock_decision_journal), lance les sondes et écrit
 * la file des cas à arbitrer (candidats à leçon). Purement OFFLINE et en lecture :
 * n'influence jamais un tour locataire.
 *
 * Usage : npx ts-node --transpile-only scripts/grock-quality-report.ts [limite]
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../src/prisma/prisma.service';
import { GrockDecisionJournalService } from '../src/grock/learning/grock-decision-journal.service';
import {
  runQualityProbes,
  type GrockLessonCandidate,
} from '../src/grock/learning/grock-quality-probes';

async function main(): Promise<void> {
  const limit = Number(process.argv[2] ?? 500);
  const prisma = new PrismaService();
  const journal = new GrockDecisionJournalService(prisma);

  const rows = await journal.loadForAnalysis(limit);
  console.log(`Journal : ${rows.length} tours analysés (limite ${limit}).`);

  const candidates = runQualityProbes(rows);

  const byKind = candidates.reduce<Record<string, number>>((acc, c) => {
    acc[c.kind] = (acc[c.kind] ?? 0) + 1;
    return acc;
  }, {});

  console.log('\n=== CAS À ARBITRER (candidats à leçon) ===');
  console.log(`Total : ${candidates.length}`, byKind);
  for (const c of candidates) {
    console.log(
      `\n[${c.severity.toUpperCase()}] ${c.kind} — ${c.summary}` +
        `\n  photoHash=${c.photoHash ?? '—'} · rows=${c.rowIds.length}` +
        c.evidence.map((e) => `\n    · ${e}`).join(''),
    );
  }

  const outDir = join(__dirname, 'out');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'grock-lesson-candidates.json');
  writeFileSync(
    outPath,
    JSON.stringify({ analyzed: rows.length, byKind, candidates } as {
      analyzed: number;
      byKind: Record<string, number>;
      candidates: GrockLessonCandidate[];
    }, null, 2),
  );
  console.log(`\nFile écrite dans ${outPath}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
