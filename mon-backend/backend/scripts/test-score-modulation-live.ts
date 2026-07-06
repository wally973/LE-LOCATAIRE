/**
 * Test live — photo + modulation cognitive par scores.
 * Usage : npx ts-node --transpile-only scripts/test-score-modulation-live.ts [photo.jpg]
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { LiaHostService } from '../src/agents/orchestrateur/conversation/lia-host.service';
import { MistralOperator } from '../src/grock/port/mistral.operator';
import { SocialHousingGuyanePack } from '../src/grock/domain/social-housing-guyane.pack';
import { GrockService } from '../src/grock/grock.service';
import { GrockPreprocessorService } from '../src/grock/preprocessor/grock-preprocessor.service';
import { targetCommunicationBand } from '../src/grock/kernel/grock-score-modulation';

const DEFAULT_PHOTO = path.join(
  __dirname,
  '..',
  'uploads',
  '022fa35f-6bd1-4c1c-ab33-db2302a77083.jpg',
);

const TITLE = 'Fuite sous évier';
const DESCRIPTION =
  'Le siphon sous l’évier fuit au niveau du raccord. Gouttes et filet d’eau visibles.';
const TENANT_MESSAGE =
  'Bonjour, mon siphon fuit sous l’évier de la cuisine, voici une photo.';

async function main(): Promise<void> {
  const photoPath = process.argv[2]?.trim() || DEFAULT_PHOTO;
  if (!fs.existsSync(photoPath)) {
    throw new Error(`Photo introuvable : ${photoPath}`);
  }
  if (!process.env.MISTRAL_API_KEY?.trim()) {
    throw new Error('MISTRAL_API_KEY absente');
  }

  const buffer = fs.readFileSync(photoPath);
  const base64 = buffer.toString('base64');

  console.log('=== Test modulation scores + photo ===');
  console.log('Photo :', photoPath);
  console.log('Signalement :', TITLE, '\n');

  const host = new LiaHostService();
  const operator = new MistralOperator(host);
  const pack = new SocialHousingGuyanePack();
  const prismaStub = {
    $executeRaw: async () => 1,
    tenantProfile: { findFirst: async () => null },
    ticket: { findMany: async () => [] },
  };
  const preprocessor = new GrockPreprocessorService(operator);
  const grock = new GrockService(
    operator,
    pack,
    preprocessor,
    prismaStub as never,
  );

  const result = await grock.runTurn({
    tenantFirstName: 'Marie',
    title: TITLE,
    description: DESCRIPTION,
    ticketHistory: [],
    sessionMessages: [],
    tenantMessage: TENANT_MESSAGE,
    mode: 'tenant_turn',
    images: [{ base64, mimeType: 'image/jpeg' }],
  });

  console.log('--- PAROLE LOCATAIRE (scores masqués côté API) ---');
  console.log(result.acknowledgment);
  console.log('\n--- ÉTAT ---');
  console.log('state:', result.state);
  console.log('scores exposés locataire:', result.scores);

  const thinking = result.thinking ?? '';
  const scoresBlock = thinking.match(/\[SCORES\][^\n]*/)?.[0] ?? '(absent)';
  const modulation = thinking.match(/\[MODULATION\][^\n]*/)?.[0] ?? '(aucune correction)';
  const doctrine = thinking.match(/\[DOCTRINE-TRIGGERS\][^\n]*/)?.[0] ?? '(aucun)';

  console.log('\n--- SCORES (thinking interne) ---');
  console.log(scoresBlock);
  console.log(modulation);
  console.log(doctrine);

  const dangerMatch = scoresBlock.match(/dangerLevel=(\d+(?:\.\d+)?)/);
  const intensityMatch = scoresBlock.match(/communicationIntensity=(\d+(?:\.\d+)?)/);
  if (dangerMatch && intensityMatch) {
    const danger = Number(dangerMatch[1]);
    const intensity = Number(intensityMatch[1]);
    const band = targetCommunicationBand(danger);
    const ok = intensity >= band.min && intensity <= band.max;
    console.log(
      `\n--- COHÉRENCE danger↔parole : danger=${danger} intensity=${intensity} bande=[${band.min}-${band.max}] → ${ok ? 'OK' : 'ÉCART'}`,
    );
  }

  const alarmist = /112|quittez|sortez du logement/i.test(result.acknowledgment);
  const dangerLow = dangerMatch && Number(dangerMatch[1]) < 4;
  if (dangerLow && alarmist) {
    console.error('\n[ÉCHEC] Alarmisme avec dangerLevel bas.');
    process.exit(1);
  }

  if (!result.acknowledgment.trim()) {
    console.error('\n[ÉCHEC] Parole vide.');
    process.exit(1);
  }

  console.log('\n=== SUCCÈS — test photo + modulation OK ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
