import type { EntretienType } from "@/types";

/** Catalogue équipements — doit être enrichi depuis Prisma selon équipements du logement. */
export const ENTRETIEN_TYPES: EntretienType[] = [
  {
    code: "VMC",
    labelFr: "VMC",
    frequency: "trimestriel",
    requiresOutdoorProof: false,
  },
  {
    code: "CHAUFFE_EAU_SOLAIRE",
    labelFr: "Chauffe-eau solaire",
    frequency: "annuel",
    requiresOutdoorProof: false,
  },
  {
    code: "SIPHONS",
    labelFr: "Siphons et évacuations intérieures",
    frequency: "trimestriel",
    requiresOutdoorProof: false,
  },
  {
    code: "RADIATEURS",
    labelFr: "Radiateurs / émetteurs",
    frequency: "annuel",
    requiresOutdoorProof: false,
  },
  {
    code: "JOINTS",
    labelFr: "Joints étanchéité sanitaires",
    frequency: "annuel",
    requiresOutdoorProof: false,
  },
  {
    code: "AERATIONS",
    labelFr: "Aérations / grilles entrées d’air",
    frequency: "trimestriel",
    requiresOutdoorProof: false,
  },
  {
    code: "CAPTEURS_SOLAIRES",
    labelFr: "Capteurs solaires",
    frequency: "annuel",
    requiresOutdoorProof: false,
  },
  {
    code: "EXTERIEUR_PRIVATIF",
    labelFr: "Espaces extérieurs privatifs (global)",
    frequency: "mensuel",
    requiresOutdoorProof: true,
  },
  {
    code: "EXT_COUR",
    labelFr: "Cour",
    frequency: "mensuel",
    requiresOutdoorProof: true,
  },
  {
    code: "EXT_JARDIN",
    labelFr: "Jardin",
    frequency: "mensuel",
    requiresOutdoorProof: true,
  },
  {
    code: "EXT_TERRASSE",
    labelFr: "Terrasse",
    frequency: "mensuel",
    requiresOutdoorProof: true,
  },
  {
    code: "EXT_PATIO",
    labelFr: "Patio",
    frequency: "mensuel",
    requiresOutdoorProof: true,
  },
];
