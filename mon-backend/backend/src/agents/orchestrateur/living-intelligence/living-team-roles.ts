/**
 * Équipe de délibération — Tabula Rasa (rôle minimal, sans doctrine imposée).
 */
import { LIA_JARVIS_POST_IDENTITY } from '../../shared/lia-jarvis-identity';
import { EXPERT_REPORT_SCHEMA_HINT } from './living-symmetric-doctrine';

export const LIVING_TEAM_CHARTER_FR =
  'Tabula Rasa — trois phrases locataire + bibliothèque AFPOL/Loi, sans brief pré-mâché.';

export const ENQUETEUR_ROLE = {
  id: 'enqueteur',
  label: 'Enquêteur — Radar physique AFPOL',
  modelHint: '8B',
  mission: 'Lire les faits bruts et la bibliothèque ; produire vision3D et intervention.',
};

export const ARCHIVISTE_ROLE = {
  id: 'archiviste',
  label: 'Archiviste — Encyclopédie légale',
  modelHint: '8B',
  mission: 'Lire les faits bruts et la bibliothèque ; produire legalVerdict.',
};

export const MAJORDOME_ROLE = {
  id: 'majordome',
  label: 'Majordome — Pilote',
  modelHint: '70B',
  mission: 'Parler au locataire après les rapports experts du tour.',
};

export function buildEnqueteurSystemPrompt(): string {
  return [
    `Tu es l’${ENQUETEUR_ROLE.label} (${ENQUETEUR_ROLE.modelHint}).`,
    ENQUETEUR_ROLE.mission,
    'Entrée : troisPhrasesLocataire + bibliothequeSavoir (AFPOL, AQC, lois, doctrine) — sans autre commentaire.',
    'Tu ne parles PAS au locataire. Rapport JSON structuré.',
    'Optionnel : "doctrineLesson" — leçon pour le Stylo (knowledge/doctrine/).',
    EXPERT_REPORT_SCHEMA_HINT,
  ].join('\n');
}

export function buildArchivisteSystemPrompt(): string {
  return [
    `Tu es l’${ARCHIVISTE_ROLE.label} (${ARCHIVISTE_ROLE.modelHint}).`,
    ARCHIVISTE_ROLE.mission,
    'Entrée : troisPhrasesLocataire + bibliothequeSavoir (lois, doctrine) — sans autre commentaire.',
    'Tu ne parles PAS au locataire. Rapport JSON structuré.',
    'Optionnel : "doctrineLesson" — leçon pour le Stylo.',
    EXPERT_REPORT_SCHEMA_HINT,
  ].join('\n');
}

export function buildMajordomeFactsSystemPrompt(): string {
  return [
    `Tu es l’${MAJORDOME_ROLE.label} (${MAJORDOME_ROLE.modelHint}) — phase extraction (pas de parole).`,
    'Entrée : troisPhrasesLocataire + bibliothequeSavoir.',
    'Enrichis humanBarrier.extractedFacts si des faits relationnels émergent.',
    'Optionnel : "doctrineLesson" — leçon pour le Stylo.',
    EXPERT_REPORT_SCHEMA_HINT,
  ].join('\n');
}

export function buildMajordomeOpeningSpeakHint(): string {
  return [
    'MODE OUVERTURE — signalement déposé, pas encore de message chat.',
    'Accueil chaleureux — reformulation courte, pas de recopie, pas de JSON.',
  ].join('\n');
}

export function buildMajordomeSpeakSystemPrompt(params: {
  creolePreferred: boolean;
  language: string;
  mode?: 'opening' | 'tenant_turn';
}): string {
  const langLine =
    params.language === 'gcf' || params.creolePreferred
      ? 'Créole guyanais naturel si Marie le préfère.'
      : 'Français chaleureux.';

  return [
    LIA_JARVIS_POST_IDENTITY,
    'Tu es Lia — Majordome. Tu parles après avoir lu rapportsExperts du tour.',
    MAJORDOME_ROLE.mission,
    langLine,
    'PAROLE = texte naturel uniquement. INTERDIT : JSON, accolades, champs "action" ou "message".',
    params.mode === 'opening' ? buildMajordomeOpeningSpeakHint() : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildTeamSymbiosisSnapshot(insights: {
  enqueteur?: string;
  archiviste?: string;
  majordome?: string;
}): {
  charter: string;
  agents: Array<{ role: string; label: string; mission: string; lastInsight: string }>;
} {
  return {
    charter: LIVING_TEAM_CHARTER_FR,
    agents: [
      {
        role: 'enqueteur',
        label: ENQUETEUR_ROLE.label,
        mission: ENQUETEUR_ROLE.mission,
        lastInsight: insights.enqueteur?.slice(0, 280) || '—',
      },
      {
        role: 'archiviste',
        label: ARCHIVISTE_ROLE.label,
        mission: ARCHIVISTE_ROLE.mission,
        lastInsight: insights.archiviste?.slice(0, 280) || '—',
      },
      {
        role: 'majordome',
        label: MAJORDOME_ROLE.label,
        mission: MAJORDOME_ROLE.mission,
        lastInsight: insights.majordome?.slice(0, 280) || '—',
      },
    ],
  };
}
