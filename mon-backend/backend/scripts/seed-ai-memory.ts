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
    title: 'Bailleur social — contexte Guyane',
    content:
      'Bailleur social en Guyane. En cas de difficulté de paiement, orienter vers le référent social.',
  },
  {
    kind: 'RESIDENCE_ARCHIVE' as const,
    title: 'Parties communes',
    content:
      'Couloirs, cage d’escalier, toiture terrasse et réseaux collectifs : responsabilité bailleur.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Électricité — panne et disjoncteur',
    content:
      'Le locataire vérifie le disjoncteur du circuit et son abonnement. ' +
      'Tableau électrique, câblage fixe encastré, parties communes : bailleur. ' +
      'Ne pas manipuler fils dénudés ou odeur de brûlé — couper et alerter le bailleur.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Éclairage localisé — ampoule déjà changée',
    content:
      'Si une seule pièce est concernée et l’ampoule a déjà été remplacée par le locataire : ' +
      'contrôler interrupteur et disjoncteur du circuit. Interrupteur ou douille usée : réparation locative. ' +
      'Disjoncteur qui ne tient pas ou défaut sur installation fixe : bailleur.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Ampoules et menues réparations électriques',
    content:
      'Remplacement d’ampoules, entretien courant des interrupteurs et douilles accessibles : ' +
      'décret 87-712, charge locataire sauf vétusté ou défaut d’installation du bailleur.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Coupure générale d’électricité',
    content:
      'Plus de courant dans tout le logement : vérifier disjoncteur général et abonnement fournisseur. ' +
      'Si l’installation du logement est en cause (hors appareils personnels) : intervention bailleur.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Logement — chauffage et eau chaude',
    content:
      'Absence de chauffage ou d’eau chaude : logement décent → bailleur (réseau, chaudière collective ou vétusté). ' +
      'Urgence en saison froide : signalement prioritaire.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Bâtiment — ascenseur et VMC',
    content:
      'Ascenseur bloqué, panne ou sécurité : bailleur. VMC / ventilation collective grippée ou bruyante : bailleur. ' +
      'Petit entretien cabine ascenseur peut être en charges récupérables (87-713).',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Bâtiment — parties communes',
    content:
      'Couloirs, hall, cage d’escalier, éclairage commun, interphone, digicode : entretien bailleur. ' +
      'Colonne d’eau, toiture, façade : bailleur. Le locataire signale avec photos et étage.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Résidence — espaces extérieurs',
    content:
      'Parking, espaces verts, aire de jeux, portail, laverie commune : périmètre résidence → bailleur ou prestataire résidence.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Nuisibles et logement décent',
    content:
      'Cafards, rats, punaises : critère de décence. Traitement organisé par le bailleur ; photos et pièces concernées.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Serrure — accès logement',
    content:
      'Serrure défectueuse ou sécurité porte du lot : bailleur. Clé perdue par le locataire : à sa charge.',
  },
  {
    kind: 'FAQ_BAILLEUR' as const,
    title: 'Humidité — photo et bricolage locataire',
    content:
      'Locataire qui a déjà traité (bricolage) : charge locative si la photo ne montre pas de dégradation structurelle manifeste. ' +
      'Bailleur si infiltration, fissure, salpêtre, remontée capillaire ou moisissure liée à la pluie/toiture.',
  },
  {
    kind: 'RESIDENCE_ARCHIVE' as const,
    title: 'Référentiel périmètres réclamation',
    content:
      'Voir data/reclamations-locataires.json : LOGEMENT (lot privatif), BATIMENT (parties communes immeuble), ' +
      'RESIDENCE (parc, parking, espaces verts). Litiges charges ou voisinage : orientation administrative, pas travaux.',
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
