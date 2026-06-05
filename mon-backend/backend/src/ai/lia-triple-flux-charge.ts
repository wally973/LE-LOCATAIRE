/**
 * Tri triple flux — Archiviste (87-712 / 87-713 / Art. 1719).
 * Jurisprudence terrain AFPOLS : cas concrets, pas seulement Bailleur/Locataire.
 */
export type TripleChargeFlux = 'LOCATIF' | 'RECUPERABLE' | 'PATRIMOINE' | 'INDETERMINE';

export interface TripleFluxClassification {
  flux: TripleChargeFlux;
  /** Textes mobilisés (affichage Archiviste / Lia-Lab). */
  legalBasis: Array<'87-712' | '87-713' | '1719'>;
  confidence: number;
  /** Cas AFPOLS / terrain invoqué en interne. */
  afpolGrounding: string;
  /** Phrase naturelle pour Marie — sans citer les décrets comme un robot. */
  tenantExplanationFr: string;
  archivisteSummary: string;
}

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Cas AFPOLS intégrés (formation pathologies logement social). */
const AFPOL_TERRAIN_CASES: Array<{
  id: string;
  flux: TripleChargeFlux;
  re: RegExp;
  grounding: string;
}> = [
  {
    id: 'joint_robinet_locatif',
    flux: 'LOCATIF',
    re: /joint (de |du )?(robinet|mitigeur)|flexible (sous |de )?(evier|évier|lavabo)|fuite (sous |de )?(evier|évier|lavabo)|siphon|bonde (de |du )?lavabo/,
    grounding:
      'AFPOLS C0237 — joint / flexible sous évier : réparation locative (87-712), Marie fait faire ou fait faire à ses frais.',
  },
  {
    id: 'colonne_fuyarde_patrimoine',
    flux: 'PATRIMOINE',
    re: /colonne|canalis(ation)? encastr|reseau collectif|refoul|eau(s)? usees|eaux usees|inondation immeuble/,
    grounding:
      'AFPOLS C0237 — colonne ou réseau collectif fuyard : patrimoine bailleur (1719), pas simple joint locatif.',
  },
  {
    id: 'toiture_etancheite_patrimoine',
    flux: 'PATRIMOINE',
    re: /toiture|toit|infiltrat|etancheit|étanchéit|facade|façade|membrane|gouttiere|gouttière|moisiss|salpetre|salpêtre|humid.*(mur|plafond|chambre|salon)|mur.*(humid|moisiss)|tache.*noir|moisissure.*(plafond|pluie|mur)|pluie.*(plafond|infiltr)/,
    grounding:
      'AFPOLS C0233 — toiture / enveloppe / infiltration : grosses réparations et entretien du bâti (1719).',
  },
  {
    id: 'vmc_collective_recuperable',
    flux: 'RECUPERABLE',
    re: /\bvmc\b|ventilation (mecanique|mécanique)|extraction collective|moteur vmc|gaines? (collectiv|commun)/,
    grounding:
      'AFPOLS C0236 — VMC collective : bailleur organise, refacturation possible en charges récupérables (87-713).',
  },
  {
    id: 'ascenseur_collectif_recuperable',
    flux: 'RECUPERABLE',
    re: /ascenseur|ascenceur|cable ascenseur|cabine ascenseur/,
    grounding:
      'Terrain bailleur social — ascenseur : remise en service bailleur ; exploitation / petit entretien cabine souvent 87-713.',
  },
  {
    id: 'chauffage_collectif_recuperable',
    flux: 'RECUPERABLE',
    re: /chauffage collectif|chaudiere collective|chaudière collective|reseau chauffage|compteur chauffage/,
    grounding:
      'Décret 87-713 — chauffage collectif : intervention bailleur, quote-part récupérable sur charges.',
  },
  {
    id: 'eau_collective_recuperable',
    flux: 'RECUPERABLE',
    re: /eau (froide|chaude) collective|compteur divisionnaire eau|compteur eau.*immeuble/,
    grounding:
      'Décret 87-713 — eau froide/chaude collective : réseau bailleur, récupération sur charges locatives.',
  },
  {
    id: 'parties_communes_patrimoine',
    flux: 'PATRIMOINE',
    re: /parties communes|hall sale|couloir|palier|cage d.?escalier|interphone (collectif|immeuble)|digicode/,
    grounding:
      'AFPOLS — parties communes : entretien structurel et équipements lourds = patrimoine (1719) ; exploitation courante peut être 713.',
  },
  {
    id: 'carrelage_desolidarisation_patrimoine',
    flux: 'PATRIMOINE',
    re: /carrel|fa[iï]ence|carreau|dalle.*(sol|soul)|soul[eè]v|d[eé]coll|plancher.*(casse|fiss)|rev[eê]tement.*sol/,
    grounding:
      'AFPOLS — revêtement de sol désolidarisé / carrelage qui se soulève : patrimoine bailleur (1719), vétusté ou vice de pose — pas simple entretien locatif.',
  },
  {
    id: 'cles_perdues_locatif',
    flux: 'LOCATIF',
    re: /cle perdue|clé perdue|clef perdue|sans cle|sans clé|oublie.*cle|oublié.*clé/,
    grounding:
      '87-712 — perte de clés / accès : charge locataire (réparation locative), sauf serrure vétuste du bailleur.',
  },
  {
    id: 'serrure_vetuste_patrimoine',
    flux: 'PATRIMOINE',
    re: /serrure.*(use|usé|vetust|vétust)|gache.*(use|usé)|porte d.?entree.*(ne ferme|coinc).*(sans.*cle perdue)/,
    grounding:
      'AFPOLS — serrure ou gâche vétuste du bailleur : patrimoine (1719), pas perte de clés locative.',
  },
  {
    id: 'ampoule_interrupteur_locatif',
    flux: 'LOCATIF',
    re: /ampoule|douille|interrupteur|lustre|plafonnier|eclairage localise/,
    grounding:
      '87-712 — éclairage localisé (ampoule, interrupteur) : réparation locative sauf installation vétuste encastrée.',
  },
  {
    id: 'prise_tableau_patrimoine',
    flux: 'PATRIMOINE',
    re: /tableau electrique|tableau électrique|disjoncteur general|disjoncteur général|reseau electrique immeuble/,
    grounding:
      'AFPOLS C0236 — installation fixe / tableau : patrimoine bailleur (1719), sécurité prioritaire.',
  },
];

const EXPLANATIONS: Record<TripleChargeFlux, string> = {
  LOCATIF:
    'Cela relève des menues réparations d’usage : vous pouvez faire intervenir un professionnel ou le faire vous-même, à votre charge.',
  RECUPERABLE:
    'Le bailleur va envoyer une entreprise, car il s’agit d’un équipement ou d’un service collectif — l’intervention sera prise en charge côté bailleur et pourra être intégrée dans vos charges récupérables (comme l’eau ou le chauffage collectif).',
  PATRIMOINE:
    'C’est un entretien ou une réparation du bâti ou des équipements du logement qui incombent au bailleur : l’intervention sera organisée et financée par le bailleur, sans être à votre charge directe.',
  INDETERMINE:
    'Je dois encore préciser la nature exacte du désordre avant de vous indiquer qui prend en charge l’intervention et le coût.',
};

function matchAfpolCase(ctx: string): (typeof AFPOL_TERRAIN_CASES)[0] | null {
  for (const c of AFPOL_TERRAIN_CASES) {
    if (c.re.test(ctx)) return c;
  }
  return null;
}

function legalBasisForFlux(flux: TripleChargeFlux): TripleFluxClassification['legalBasis'] {
  switch (flux) {
    case 'LOCATIF':
      return ['87-712'];
    case 'RECUPERABLE':
      return ['87-713', '1719'];
    case 'PATRIMOINE':
      return ['1719'];
    default:
      return [];
  }
}

/**
 * Classe le signalement dans LOCATIF / RÉCUPÉRABLE / PATRIMOINE.
 */
export function classifyTripleChargeFlux(params: {
  title: string;
  description: string;
  message?: string;
  activeFlows?: string[];
  tradeNeeded?: string | null;
}): TripleFluxClassification {
  const ctx = norm(
    [params.title, params.description, params.message ?? '', ...(params.activeFlows ?? [])]
      .filter(Boolean)
      .join(' '),
  );

  const afpol = matchAfpolCase(ctx);
  if (afpol) {
    const flux = afpol.flux;
    return {
      flux,
      legalBasis: legalBasisForFlux(flux),
      confidence: 0.88,
      afpolGrounding: afpol.grounding,
      tenantExplanationFr: EXPLANATIONS[flux],
      archivisteSummary: `${flux} — ${afpol.grounding}`,
    };
  }

  if (/refoul|colonne|parties communes|toiture|infiltrat|structure|fissure|salpetre|salpêtre|moisiss|humid.*mur|tache.*noir/.test(ctx)) {
    return {
      flux: 'PATRIMOINE',
      legalBasis: ['1719'],
      confidence: 0.75,
      afpolGrounding: 'Indices structure / collectif / infiltration → patrimoine bailleur.',
      tenantExplanationFr: EXPLANATIONS.PATRIMOINE,
      archivisteSummary: 'PATRIMOINE — désordre du bâti ou réseau immeuble (1719).',
    };
  }

  if (/\bvmc\b|ascenseur|chauffage collectif|eau.*collective|compteur.*(chauffage|eau)/.test(ctx)) {
    return {
      flux: 'RECUPERABLE',
      legalBasis: ['87-713', '1719'],
      confidence: 0.72,
      afpolGrounding: 'Équipement ou service collectif → bailleur opère, 87-713 possible.',
      tenantExplanationFr: EXPLANATIONS.RECUPERABLE,
      archivisteSummary: 'RÉCUPÉRABLE — intervention bailleur, charges récupérables possibles.',
    };
  }

  if (/joint|flexible|siphon|robinet|evier|évier|ampoule|wc\b|debouch|débouch/.test(ctx)) {
    return {
      flux: 'LOCATIF',
      legalBasis: ['87-712'],
      confidence: 0.7,
      afpolGrounding: 'Point d’usage ou entretien courant → réparation locative.',
      tenantExplanationFr: EXPLANATIONS.LOCATIF,
      archivisteSummary: 'LOCATIF — menue réparation / entretien locataire (87-712).',
    };
  }

  return {
    flux: 'INDETERMINE',
    legalBasis: [],
    confidence: 0.35,
    afpolGrounding: 'Faits insuffisants pour trancher le flux financier.',
    tenantExplanationFr: EXPLANATIONS.INDETERMINE,
    archivisteSummary: 'INDETERMINE — compléter le diagnostic physique.',
  };
}

/** Normalise une charge LLM héritée (BAILLEUR/LOCATAIRE) vers le tri triple. */
export function normalizeLegacyChargeHorizon(raw: string): TripleChargeFlux {
  const t = norm(raw);
  if (t === 'locatif' || t === 'locataire') return 'LOCATIF';
  if (t === 'recuperable' || t === 'récupérable' || t.includes('713')) return 'RECUPERABLE';
  if (t === 'patrimoine' || t === 'bailleur') return 'PATRIMOINE';
  if (t === 'mixte') return 'INDETERMINE';
  return 'INDETERMINE';
}

export function tripleFluxToDisplayLabel(flux: TripleChargeFlux): string {
  switch (flux) {
    case 'LOCATIF':
      return 'LOCATIF (87-712)';
    case 'RECUPERABLE':
      return 'RÉCUPÉRABLE (87-713)';
    case 'PATRIMOINE':
      return 'PATRIMOINE (1719)';
    default:
      return 'INDETERMINE';
  }
}
