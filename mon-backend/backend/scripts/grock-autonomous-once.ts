/**
 * Test Grock autonome — un message locataire, appel Mistral réel.
 * Usage : npx ts-node scripts/grock-autonomous-once.ts
 */
import 'dotenv/config';
import { LiaHostService } from '../src/agents/orchestrateur/conversation/lia-host.service';
import { GrockService } from '../src/grock/grock.service';
import { loadGrockSocialHousingOperationsBlock } from '../src/grock/grock-social-housing-operations';

const TENANT_MESSAGE =
  "Bonjour, j'ai de l'eau qui tombe du plafond. Le voisin du dessus dit que sa salle de bain fuit.";

async function main(): Promise<void> {
  if (!process.env.MISTRAL_API_KEY?.trim()) {
    throw new Error('MISTRAL_API_KEY absente dans mon-backend/backend/.env');
  }

  const block = loadGrockSocialHousingOperationsBlock();
  const hasSinistreFiche =
    block.includes('Assurances habitation') ||
    block.toLowerCase().includes('déclaration de sinistre');
  console.log('Fiche sinistre injectée :', hasSinistreFiche ? 'OUI' : 'NON');

  const host = new LiaHostService();
  const prisma = {
    $executeRaw: async () => 1,
    tenantProfile: { findFirst: async () => null },
    ticket: { findMany: async () => [] },
  };
  const grock = new GrockService(host, prisma as never);

  const result = await grock.runTurn({
    tenantFirstName: 'Marie',
    title: 'Eau au plafond',
    description: TENANT_MESSAGE,
    ticketHistory: [],
    sessionMessages: [],
    tenantMessage: TENANT_MESSAGE,
    mode: 'tenant_turn',
  });

  console.log('\n=== RÉSULTAT GROCK ===');
  console.log('state:', result.state);
  console.log('model:', result.model);
  console.log('\n--- acknowledgment (Marie) ---');
  console.log(result.acknowledgment);
  console.log('\n--- next_action ---');
  console.log(result.nextAction);
  console.log('\n--- note_interne ---');
  console.log(result.noteInterne ?? '(vide)');
  console.log('\n--- thinking ---');
  console.log(result.thinking ?? '(vide)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
