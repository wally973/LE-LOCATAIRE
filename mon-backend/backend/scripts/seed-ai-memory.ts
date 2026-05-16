/**
 * Alimente AiMemory pour les simulations Sprint G (juriste / RAG).
 * À lancer après seed-lia-demo.ts :
 *   npx ts-node scripts/seed-ai-memory.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LANDLORD_EMAIL = 'demo.bailleur@lelocataire.test';

const CHUNKS = [
  {
    kind: 'DECRET' as const,
    title: 'Décret 87-712 — réparations locatives',
    content:
      'Le locataire assure l’entretien courant et les menues réparations. ' +
      'Le bailleur prend en charge les grosses réparations et les éléments d’équipement ' +
      'impliquant la structure ou les parties communes.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Fuite sous évier / robinet',
    content:
      'Une fuite au niveau du siphon, du robinet ou des flexibles sous évier relève en principe ' +
      'de l’entretien locatif (charge locataire). Une fuite sur canalisation encastrée ou colonne ' +
      'collective relève du bailleur.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Humidité et moisissures',
    content:
      'Moisissure localisée sans atteinte structurelle : souvent ventilation + entretien locataire. ' +
      'Infiltration toiture, façade ou mur porteur : charge bailleur.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: '2terHabitat — contexte',
    content:
      'Bailleur social en Guyane. En cas de difficulté de paiement, orienter vers le référent social.',
  },
  {
    kind: 'RESIDENCE_ARCHIVE' as const,
    title: 'Parties communes',
    content:
      'Couloirs, cage d’escalier, toiture terrasse et réseaux collectifs : responsabilité bailleur.',
  },
];

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: LANDLORD_EMAIL },
  });
  if (!user) {
    console.error('Lancez d’abord: npx ts-node scripts/seed-lia-demo.ts');
    process.exit(1);
  }
  const landlord = await prisma.landlordProfile.findUnique({
    where: { userId: user.id },
  });
  if (!landlord) {
    console.error('Profil bailleur démo introuvable');
    process.exit(1);
  }

  for (const chunk of CHUNKS) {
    const existing = await prisma.aiMemory.findFirst({
      where: {
        landlordProfileId: landlord.id,
        title: chunk.title,
      },
    });
    if (existing) {
      await prisma.aiMemory.update({
        where: { id: existing.id },
        data: { content: chunk.content, kind: chunk.kind },
      });
      console.log(`MAJ  ${chunk.title}`);
    } else {
      await prisma.aiMemory.create({
        data: {
          landlordProfileId: landlord.id,
          kind: chunk.kind,
          title: chunk.title,
          content: chunk.content,
        },
      });
      console.log(`OK   ${chunk.title}`);
    }
  }

  console.log(`\n${CHUNKS.length} entrées AiMemory pour bailleur #${landlord.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
