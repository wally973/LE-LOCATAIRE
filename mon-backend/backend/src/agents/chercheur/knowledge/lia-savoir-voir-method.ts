/**
 * Méthode Savoir-Voir — document de référence pour techniciens / référents (Pro Briefing).
 */

export interface SavoirVoirStep {
  order: number;
  name: string;
  what: string;
  technicianRole: string;
}

export interface SavoirVoirMethodBrief {
  title: string;
  tagline: string;
  steps: SavoirVoirStep[];
  commitments: string[];
  references: string[];
}

/** Contenu stable exposé dans le Pro Briefing et la doc métier. */
export function getSavoirVoirMethodBrief(): SavoirVoirMethodBrief {
  return {
    title: 'Méthode Savoir-Voir',
    tagline:
      'Fin du bricolage : le dossier est qualifié avant le déplacement, à partir de ce que le locataire décrit — pas de diagnostic « au feeling ».',
    steps: [
      {
        order: 1,
        name: 'Voir — description locataire',
        what:
          'Le locataire décrit avec ses mots (pièce, depuis quand, constat). Il n’est pas technicien : Lia ne lui demande pas de diagnostiquer.',
        technicianRole:
          'Lire la description initiale et le fil : c’est la source primaire du dossier.',
      },
      {
        order: 2,
        name: 'Organisateur — questions ciblées',
        what:
          'Lia pose des questions simples (intake), pilotées par le catalogue logique des pannes (`panne-diagnostic-logique.json`) pour éliminer des causes.',
        technicianRole:
          'Vérifier les réponses intake : elles complètent ou confirment la description.',
      },
      {
        order: 3,
        name: 'Savoir — recherche interne',
        what:
          'Avant le verdict : fiches métier, pathologies (AFPOLS/AQC), matrice installations/charges/vétusté, affaires similaires, contexte entrée / GPA.',
        technicianRole:
          'Le bloc « Recherche » et les affaires proches expliquent pourquoi Lia oriente une charge — pas une opinion isolée.',
      },
      {
        order: 4,
        name: 'Voir — signes et hypothèses',
        what:
          'Signes cliniques (odeur, couleur, texture, localisation) et hypothèses différentielles ; photo si le métier l’exige.',
        technicianRole:
          'Comparer votre constat terrain aux hypothèses : confirmer, infirmer ou rectifier (expert).',
      },
      {
        order: 5,
        name: 'Conclure — règles puis IA',
        what:
          'Pathologiste + juriste : règles déterministes (87-712, encastré, douche, électricité…) puis synthèse. Verdict explicable.',
        technicianRole:
          'La charge proposée est argumentée ; en cas de doute, déplacement pour trancher (Q54) ou rectification expert.',
      },
    ],
    commitments: [
      'Pas de conclusion sans description + intake (+ photo quand requis).',
      'Vétusté et installation encastrée → bailleur, même si l’acte ressemble à une réparation locative.',
      'Votre rectification expert prime sur le diagnostic IA.',
      'Objectif : moins de déplacements « pour voir » — intervention avec dossier déjà structuré.',
    ],
    references: [
      'NOTE.md — Savoir-Voir, Q42, Q43, Q65, Q68',
      'knowledge/README.md',
      'data/installations-charges-vetuste.json',
    ],
  };
}
