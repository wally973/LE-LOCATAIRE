/**
 * Lance les 10 scénarios or (mode LLM-first).
 *
 * Usage :
 *   npx ts-node scripts/run-golden-scenarios.ts          # structure seule (sans Groq)
 *   npx ts-node scripts/run-golden-scenarios.ts --live   # avec GROQ_API_KEY
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LiaGoldenRunnerService } from '../src/agents/golden/lia-golden-runner.service';
import { loadGoldenScenarios } from '../src/agents/golden/lia-golden-scenarios.loader';

async function main() {
  const live = process.argv.includes('--live');
  const file = loadGoldenScenarios();
  console.log(`Scénarios or : ${file.scenarios.length} (v${file.version})`);
  console.log(live ? 'Mode LIVE (Groq)' : 'Mode structure (sans appel LLM)');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const runner = app.get(LiaGoldenRunnerService);
    const results = await runner.runAll({ live });
    let failed = 0;
    for (const r of results) {
      if (r.skippedLive) {
        console.log(`  ○ ${r.id} — ${r.label} (live non exécuté)`);
        continue;
      }
      if (r.passed) {
        console.log(`  ✓ ${r.id} — ${r.label}`);
      } else {
        failed++;
        console.log(`  ✗ ${r.id} — ${r.label}`);
        for (const issue of r.issues) {
          console.log(`      [${issue.step}] ${issue.rule}: ${issue.detail}`);
        }
      }
    }
    if (!live) {
      console.log(
        '\nPour exécuter avec Lia (Groq) : définir GROQ_API_KEY puis --live',
      );
    }
    process.exit(failed > 0 ? 1 : 0);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
