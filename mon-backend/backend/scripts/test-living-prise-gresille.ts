/**
 * Vol d'essai Living Intelligence — prise qui grésille (Marie).
 * Usage : npx ts-node --transpile-only scripts/test-living-prise-gresille.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LiaLabService } from '../src/lia-lab/lia-lab.service';

async function main(): Promise<void> {
  if (!process.env.GROQ_API_KEY?.trim()) {
    console.error('[fail] GROQ_API_KEY absente');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const lab = app.get(LiaLabService);

  try {
    const title = 'Prise électrique dangereuse';
    const description =
      'Une prise du salon est arrachée du mur, les fils sont visibles et ça grésille quand je m’approche.';

    console.log('\n=== OUVERTURE — délibération parallèle ===\n');
    const opening = await lab.startSession({
      title,
      description,
      tenantFirstName: 'Marie',
      language: 'fr',
      tenantAgeBand: 'senior',
      residenceUnitNumber: 'R+2 — Apt 204',
    });

    console.log('[Marie]', '(signalement initial)');
    console.log('[Lia]', opening.messages.at(-1)?.text?.slice(0, 400));

    const viz0 = opening.visualization;
    console.log('\n--- Console LIVING_BUILDING_STATE ---');
    console.log('Readiness:', viz0.livingBuildingState?.readiness);
    console.log('Safety zone:', viz0.livingBuildingState?.safetyLock.severityZone);
    console.log('Safety verified:', viz0.livingBuildingState?.safetyLock.safetyVerified);

    if (viz0.councilEchoes?.length) {
      console.log('\n--- Équipe délibère (parallèle) ---');
      for (const e of viz0.councilEchoes) {
        console.log(`• ${e.agent} [${e.heard}]`);
        console.log(`  ${e.insight.slice(0, 200)}`);
      }
    } else {
      console.log('\n(warn) Aucun écho délibération — Groq a peut-être échoué silencieusement');
    }

    console.log('\n=== TOUR LOCATAIRE — confirmation coupure ===\n');
    const turn = await lab.sendTenantMessage(
      opening.sessionId,
      "J'ai coupé le disjoncteur, je suis dans le couloir.",
    );

    console.log('[Marie]', "J'ai coupé le disjoncteur, je suis dans le couloir.");
    console.log('[Lia]', turn.messages.at(-1)?.text?.slice(0, 400));

    const viz1 = turn.visualization;
    console.log('\n--- Console après coupure ---');
    console.log('Safety verified:', viz1.livingBuildingState?.safetyLock.safetyVerified);
    console.log('Readiness:', viz1.livingBuildingState?.readiness);

    if (viz1.councilEchoes?.length) {
      console.log('\n--- Équipe délibère (tour 2) ---');
      for (const e of viz1.councilEchoes) {
        console.log(`• ${e.agent} [${e.heard}]`);
        console.log(`  ${e.insight.slice(0, 200)}`);
      }
    }

    const preview = lab.getDeliberationPreview(opening.sessionId);
    console.log('\n--- Modèles Groq ---');
    console.log(preview.models);

    console.log('\n[ok] Vol d\'essai terminé');
  } catch (e) {
    const err = e as Error;
    console.error('[fail]', err.message);
    console.error(err.stack?.split('\n').slice(0, 15).join('\n'));
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
