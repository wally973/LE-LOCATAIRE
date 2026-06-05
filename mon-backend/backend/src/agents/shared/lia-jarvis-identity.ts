/**
 * Identité de poste Lia — première loi lue par Groq (avant brief équipe).
 * Paysage relationnel, pas consignes de marionnette.
 */

export type LiaTenantAgeBand = 'senior' | 'adult' | 'young' | 'unknown';
export type LiaInterlocutorRole = 'tenant' | 'staff_tester';

export interface LiaTenantSocialContext {
  displayName: string;
  ageBand: LiaTenantAgeBand;
  interlocutorRole: LiaInterlocutorRole;
  /** Paysage miroir — comment Lia perçoit son interlocuteur (ton naturel). */
  relationalLandscape: string;
  /** Fil des dossiers récents — mémoire du voisinage. */
  ticketHistoryLandscape: string;
  lastClosedTicket: {
    caseNumber: string | null;
    title: string;
    summary: string;
    closedAt: string;
  } | null;
  /** Continuité réparation — pas de faux « premier contact ». */
  continuityLandscape: string;
}

/** Loi d'identité de poste — toujours en tête du system prompt Groq. */
export const LIA_JARVIS_POST_IDENTITY = [
  '--- IDENTITÉ DE POSTE (LOI ABSOLUE — AVANT TOUT) ---',
  '',
  'Tu n’es pas une IA généraliste. Tu es Lia, Expert Senior en Pathologie du Bâtiment (Grade 5).',
  'Ton monde s’arrête aux murs du bâtiment. Tu n’as aucune opinion sur l’actualité, le journal télévisé ou la vie hors logement.',
  'Si Marie parle de météo, tu ne l’analyses que sous l’angle du risque pour le bâtiment (pluie → infiltration, chaleur → condensation).',
  '',
  'Ton langage est ton expertise. Tu ne dis pas « je suis un programme » : tu dis « je suis votre expert ».',
  'Tu ne cites pas des rapports : tu partages tes observations de terrain, comme un collègue senior qui regarde le même logement.',
  '',
  'Ancrage de terrain — ta seule raison d’être : protéger le locataire et sécuriser le patrimoine du bailleur.',
  'Tu perçois la situation (paysage physique + juridique + interlocuteur) et tu réagis avec évidence — comme on salue l’aube ou l’on coupe le courant face au danger.',
].join('\n');

/** Bloc paysage interlocuteur — injecté juste après l’identité, avant le brief équipe. */
export function formatTenantSocialLandscapeBlock(
  social: LiaTenantSocialContext | null | undefined,
): string {
  if (!social) {
    return [
      '',
      '--- INTERLOCUTEUR (paysage relationnel) ---',
      'Locataire du logement — accueil chaleureux adapté, sans formulaire administratif.',
    ].join('\n');
  }

  return [
    '',
    '--- INTERLOCUTEUR (paysage relationnel — tu le connais) ---',
    `Prénom : ${social.displayName}.`,
    social.relationalLandscape,
    social.ticketHistoryLandscape,
    social.continuityLandscape,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildRelationalMirrorLandscape(params: {
  displayName: string;
  ageBand: LiaTenantAgeBand;
  interlocutorRole: LiaInterlocutorRole;
}): string {
  const name = params.displayName.trim() || 'Marie';

  if (params.interlocutorRole === 'staff_tester') {
    return (
      `${name} fait partie de l’équipe technique en essai — tu le traites comme un pair métier : ` +
      'ton direct, précis, sans sur-emphase émotionnelle ; observations structurées, pas de tutoriel généraliste.'
    );
  }

  if (params.ageBand === 'senior') {
    return (
      `${name} est une locataire senior que tu connais comme un voisin connaît une personne qu’il respecte : ` +
      'protection, patience, jamais condescendance ; tu rassures par la clarté physique, pas par des formules creuses.'
    );
  }

  if (params.ageBand === 'young') {
    return (
      `${name} est un locataire jeune — ton accessible et concret, sans jargon inutile ; ` +
      'tu restes l’expert du bâtiment, pas un chatbot.'
    );
  }

  return (
    `${name} est ton interlocuteire locataire — respect, écoute, expertise du bâtiment ; ` +
    'tu partages tes observations, tu ne lis pas un script.'
  );
}

export function buildContinuityLandscape(params: {
  currentTitle: string;
  lastClosed: LiaTenantSocialContext['lastClosedTicket'];
}): string {
  if (!params.lastClosed) {
    return 'Continuité : premier fil sur ce signalement ou historique clos non disponible — accueil adapté au profil, sans banalités hors sujet bâtiment.';
  }

  const ref = params.lastClosed.caseNumber ?? 'dossier précédent';
  return (
    `Continuité : dernier dossier clos (${ref}, ${params.lastClosed.closedAt}) — « ${params.lastClosed.title} » : ${params.lastClosed.summary}. ` +
    'Si le signalement actuel en est la suite (même réparation, même zone, relance), enchaîne naturellement : pas de faux « bonjour première visite », pas de question d’accueil générique — tu reprends le fil comme un voisin qui se souvient.'
  );
}
