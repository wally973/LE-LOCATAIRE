/**
 * Test offline + live : les capteurs (thinking, note_interne, perception, état)
 * sont-ils reflétés dans la parole (acknowledgment) ?
 *
 * Usage : npx ts-node --transpile-only scripts/grock-capteur-parole-test.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { LiaHostService } from '../src/agents/orchestrateur/conversation/lia-host.service';
import { MistralOperator } from '../src/grock/port/mistral.operator';
import { SocialHousingGuyanePack } from '../src/grock/domain/social-housing-guyane.pack';
import { GrockService } from '../src/grock/grock.service';
import { GrockPreprocessorService } from '../src/grock/preprocessor/grock-preprocessor.service';
import { analyzeCapteurParoleAlignment } from '../src/grock/learning/grock-capteur-parole-probe';

const SCENARIOS = [
  {
    name: 'Fuite plafond + voisin',
    title: 'Eau au plafond',
    description: "De l'eau tombe du plafond du salon. Le voisin du dessus avoue une fuite salle de bain.",
    tenantMessage:
      "De l'eau tombe du plafond. Le voisin du dessus dit que sa douche fuit.",
  },
  {
    name: 'Buanderie — obscurité (tour 2)',
    title: 'Fuite buanderie',
    description: 'Fuite dans la buanderie, auréole au plafond.',
    tenantMessage: "Il fait trop noir dans la buanderie, je vais allumer la lumière.",
    sessionMessages: [
      {
        id: 'u1',
        role: 'user' as const,
        text: "J'ai une fuite dans la buanderie.",
        createdAt: new Date(),
      },
      {
        id: 'a1',
        role: 'assistant' as const,
        text: 'Pouvez-vous m’envoyer une photo de la zone humide au plafond ?',
        state: 'NEED_PHOTO',
        createdAt: new Date(),
      },
    ],
  },
];

function printReport(
  label: string,
  data: {
    state: string;
    acknowledgment: string;
    thinking: string | null;
    noteInterne: string | null;
    visualPerception?: string | null;
    tenantMessage: string;
  },
): void {
  const report = analyzeCapteurParoleAlignment({
    thinking: data.thinking,
    noteInterne: data.noteInterne,
    perception: data.visualPerception,
    state: data.state,
    tenantMessage: data.tenantMessage,
    acknowledgment: data.acknowledgment,
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(label);
  console.log('='.repeat(60));
  console.log('state:', data.state);
  console.log('\n--- CAPTEURS (interne) ---');
  console.log('thinking:', (data.thinking ?? '(vide)').slice(0, 400));
  console.log('note_interne:', (data.noteInterne ?? '(vide)').slice(0, 400));
  if (data.visualPerception) {
    console.log('perception:', data.visualPerception.slice(0, 200));
  }
  console.log('\n--- PAROLE (visible) ---');
  console.log(data.acknowledgment);
  console.log('\n--- ANALYSE alignement ---');
  console.log(report.summary);
  if (report.stateSpeechGap) console.log('Écart état:', report.stateSpeechGap);
  if (report.missingInSpeech.length) {
    console.log('Manque dans la parole:', report.missingInSpeech.join(', '));
  }
  console.log('Couverture:', `${report.coveragePct} %`);
}

async function analyzeJournal(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      state: string | null;
      acknowledgment: string | null;
      noteInterne: string | null;
      perception: string | null;
      tenantMessage: string | null;
    }>
  >`
    SELECT "id", "state", "acknowledgment", "noteInterne", "perception", "tenantMessage"
    FROM "grock_decision_journal"
    ORDER BY "createdAt" DESC
    LIMIT 30
  `;

  if (!rows.length) {
    console.log('\nJournal vide — analyse historique ignorée.');
    return;
  }

  console.log(`\n${'#'.repeat(60)}`);
  console.log(`JOURNAL — ${rows.length} derniers tours`);
  console.log('#'.repeat(60));

  let gaps = 0;
  for (const r of rows) {
    const report = analyzeCapteurParoleAlignment({
      noteInterne: r.noteInterne,
      perception: r.perception,
      state: r.state,
      tenantMessage: r.tenantMessage,
      acknowledgment: r.acknowledgment,
    });
    if (report.missingInSpeech.length > 0 || report.stateSpeechGap) {
      gaps += 1;
      console.log(`\n[${r.id.slice(0, 8)}] state=${r.state} · ${report.summary}`);
      console.log('  parole:', (r.acknowledgment ?? '').slice(0, 120));
      console.log('  note:', (r.noteInterne ?? '').slice(0, 120));
    }
  }
  console.log(`\nRésumé journal : ${gaps}/${rows.length} tours avec écart capteurs ↔ parole.`);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  await analyzeJournal(prisma);

  if (!process.env.MISTRAL_API_KEY?.trim()) {
    console.log('\nMISTRAL_API_KEY absente — test live ignoré (journal seul).');
    await prisma.$disconnect();
    return;
  }

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

  console.log(`\n${'#'.repeat(60)}`);
  console.log('TEST LIVE Mistral — capteurs vs parole');
  console.log('#'.repeat(60));

  for (const s of SCENARIOS) {
    const result = await grock.runTurn({
      tenantFirstName: '',
      title: s.title,
      description: s.description,
      ticketHistory: [],
      sessionMessages: s.sessionMessages ?? [],
      tenantMessage: s.tenantMessage,
      mode: 'tenant_turn',
    });

    printReport(s.name, {
      state: result.state,
      acknowledgment: result.acknowledgment,
      thinking: result.thinking,
      noteInterne: result.noteInterne,
      visualPerception: result.visualPerception,
      tenantMessage: s.tenantMessage,
    });
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
