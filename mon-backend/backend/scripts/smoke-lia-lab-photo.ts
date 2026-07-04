/**
 * Smoke test — perception visuelle Grock (Pixtral) via Lia-Lab.
 * Usage : npx ts-node --transpile-only scripts/smoke-lia-lab-photo.ts [chemin-image]
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LiaLabService } from '../src/lia-lab/lia-lab.service';
import { GROCK_PERCEPTION_LOG_TITLE } from '../src/grock/grock-vision.prompt';

async function main(): Promise<void> {
  const defaultImage = join(
    __dirname,
    '..',
    'uploads',
    '022fa35f-6bd1-4c1c-ab33-db2302a77083.jpg',
  );
  const imagePath = process.argv[2]?.trim() || defaultImage;

  if (!existsSync(imagePath)) {
    console.error('[fail] Image introuvable :', imagePath);
    process.exitCode = 1;
    return;
  }

  const buffer = readFileSync(imagePath);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const lab = app.get(LiaLabService);

  try {
    const view = await lab.startSession({
      title: 'Fuite buanderie',
      description: "Fuite d'eau dans la buanderie.",
      tenantFirstName: 'Marie',
      language: 'fr',
    });
    console.log('[ok] session:', view.sessionId);
    console.log('[ok] opening:', view.messages[0]?.text?.slice(0, 100));

    await lab.sendTenantMessage(
      view.sessionId,
      "J'ai de l'eau dans ma buanderie, voici une photo.",
    );

    const afterPhoto = await lab.sendTenantPhoto(
      view.sessionId,
      buffer,
      'image/jpeg',
      "Voici la buanderie — de l'eau par terre.",
    );

    console.log('\n---', GROCK_PERCEPTION_LOG_TITLE, '---');
    if (afterPhoto.visualPerception) {
      console.log(afterPhoto.visualPerception);
      console.log('\n[ok] modèle vision:', afterPhoto.visionModel ?? '(inconnu)');
    } else {
      console.warn('[warn] Perception vide — vérifier MISTRAL_API_KEY et GROCK_VISION_MODEL');
      process.exitCode = 1;
    }

    const lastGrock = [...afterPhoto.messages].reverse().find((m) => m.role === 'grock');
    console.log('\n--- Réponse Grock ---');
    console.log(lastGrock?.text?.slice(0, 400) ?? '(vide)');
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
