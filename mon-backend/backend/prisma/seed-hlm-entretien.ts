/**
 * Seed idempotent du catalogue `HlmEntretienType` (socle HLM).
 *
 * Usage (depuis la racine du projet backend) :
 *   npx ts-node prisma/seed-hlm-entretien.ts
 *
 * Prérequis : enums à jour + migration appliquée (`npx prisma migrate dev`).
 */
import {
  PrismaClient,
  type EntretienTypeCode,
  type MaintenanceFrequency,
} from '@prisma/client';

const prisma = new PrismaClient();

type CatalogRow = {
  code: EntretienTypeCode;
  labelFr: string;
  description: string | null;
  frequency: MaintenanceFrequency;
  requiresOutdoorContext: boolean;
};

/** Catalogue demandé : création uniquement si le code est absent. */
const HLM_ENTRETIEN_CATALOG: CatalogRow[] = [
  {
    code: 'VMC_FILTRE',
    labelFr: 'VMC — filtre',
    description: 'Contrôle et remplacement du filtre de la ventilation mécanique contrôlée.',
    frequency: 'TRIMESTRIEL',
    requiresOutdoorContext: false,
  },
  {
    code: 'VMC_BOITIER',
    labelFr: 'VMC — boîtier / groupe',
    description: 'Entretien du boîtier ou du groupe VMC (nettoyage, points de fixation).',
    frequency: 'ANNUEL',
    requiresOutdoorContext: false,
  },
  {
    code: 'SOL_CAPTEUR',
    labelFr: 'Chauffe-eau solaire — capteurs',
    description: 'Contrôle visuel et nettoyage léger des capteurs solaires.',
    frequency: 'TRIMESTRIEL',
    requiresOutdoorContext: true,
  },
  {
    code: 'SOL_PRESSION',
    labelFr: 'Chauffe-eau solaire — pression circuit',
    description: 'Contrôle de la pression du circuit hydraulique solaire.',
    frequency: 'TRIMESTRIEL',
    requiresOutdoorContext: false,
  },
  {
    code: 'SIPHON_NETTOYAGE',
    labelFr: 'Siphons — nettoyage',
    description: 'Nettoyage et débouchage léger des siphons.',
    frequency: 'MENSUEL',
    requiresOutdoorContext: false,
  },
  {
    code: 'EXT_TONTE',
    labelFr: 'Extérieur privatif — tonte',
    description: 'Tonte des espaces verts du lot privatif.',
    frequency: 'MENSUEL',
    requiresOutdoorContext: true,
  },
  {
    code: 'EXT_DEBROUSSAILLAGE',
    labelFr: 'Extérieur privatif — débroussaillage',
    description: 'Débroussaillage et maintien des parcelles accessibles.',
    frequency: 'MENSUEL',
    requiresOutdoorContext: true,
  },
  {
    code: 'EXT_GOUTTIERE',
    labelFr: 'Extérieur privatif — gouttières',
    description: 'Nettoyage et dégagement des gouttières et descentes.',
    frequency: 'TRIMESTRIEL',
    requiresOutdoorContext: true,
  },
  {
    code: 'EXT_EAU_STAGNANTE',
    labelFr: 'Extérieur privatif — eaux stagnantes',
    description: 'Contrôle des zones à risque de stagnation d’eau (nuisibles).',
    frequency: 'HEBDOMADAIRE',
    requiresOutdoorContext: true,
  },
];

async function main(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const row of HLM_ENTRETIEN_CATALOG) {
    const existing = await prisma.hlmEntretienType.findUnique({
      where: { code: row.code },
    });

    if (existing) {
      skipped += 1;
      console.log(`[skip] ${row.code} — déjà présent`);
      continue;
    }

    await prisma.hlmEntretienType.create({
      data: {
        code: row.code,
        labelFr: row.labelFr,
        description: row.description,
        frequency: row.frequency,
        requiresOutdoorContext: row.requiresOutdoorContext,
      },
    });
    created += 1;
    console.log(`[ok]   ${row.code} — créé`);
  }

  console.log(`Terminé — créés: ${created}, ignorés (existants): ${skipped}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
