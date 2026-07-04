/**
 * Smoke test — démarrage Lia-Lab (repro Internal Server Error).
 * Usage : npx ts-node --transpile-only scripts/smoke-lia-lab-start.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LiaLabService } from '../src/lia-lab/lia-lab.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const lab = app.get(LiaLabService);
  try {
    const view = await lab.startSession({
      title: 'logement',
      description:
        "des goutes d'eau coule derrière les toilette, cela viens du plafond",
      tenantFirstName: 'Marie',
      language: 'fr',
    });
    console.log('[ok] messages:', view.messages.length);
    console.log('[ok] grock:', view.messages[0]?.text?.slice(0, 120));
  } catch (e) {
    const err = e as Error;
    console.error('[fail]', err.message);
    console.error(err.stack?.split('\n').slice(0, 12).join('\n'));
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
