/**
 * Équipe de délibération — Intelligence Symétrique Niveau 6.
 */
import { LIA_JARVIS_POST_IDENTITY } from '../../shared/lia-jarvis-identity';
import {
  EXPERT_REPORT_SCHEMA_HINT,
  loadSymmetricDoctrine,
  SYMMETRIC_CHARTER_FR,
} from './living-symmetric-doctrine';

export const LIVING_TEAM_CHARTER_FR = SYMMETRIC_CHARTER_FR;

export const ENQUETEUR_ROLE = {
  id: 'enqueteur',
  label: 'Enquêteur — Radar physique AFPOL',
  modelHint: '8B',
  mission: 'Visualisation 3D · flux · cinétique du danger · doute constructif',
};

export const ARCHIVISTE_ROLE = {
  id: 'archiviste',
  label: 'Archiviste — Encyclopédie légale',
  modelHint: '8B',
  mission: '87-712 · 87-713 · 1719 · équilibre financier · veto social',
};

export const MAJORDOME_ROLE = {
  id: 'majordome',
  label: 'Majordome — Pilote',
  modelHint: '70B',
  mission: 'Âme · empathie · créole · parole APRÈS instruments de bord',
};

function doctrineBlock(): string {
  const d = loadSymmetricDoctrine();
  return [d.charter, '', '--- MISSION JARVIS ---', d.missionJarvis, '', '--- VISUAL_LOGIC ---', d.visualLogic].join(
    '\n',
  );
}

export function buildEnqueteurSystemPrompt(): string {
  return [
    doctrineBlock(),
    '',
    `Tu es l’${ENQUETEUR_ROLE.label} (${ENQUETEUR_ROLE.modelHint}).`,
    ENQUETEUR_ROLE.mission,
    'Tu ne parles PAS à l’interlocuteur. Tu rédiges un rapport d’expertise physique.',
    EXPERT_REPORT_SCHEMA_HINT,
  ].join('\n');
}

export function buildArchivisteSystemPrompt(): string {
  return [
    doctrineBlock(),
    '',
    `Tu es l’${ARCHIVISTE_ROLE.label} (${ARCHIVISTE_ROLE.modelHint}).`,
    ARCHIVISTE_ROLE.mission,
    'Tu ne parles PAS à l’interlocuteur. Tu rédiges un rapport juridique libre.',
    EXPERT_REPORT_SCHEMA_HINT,
  ].join('\n');
}

export function buildMajordomeFactsSystemPrompt(): string {
  return [
    doctrineBlock(),
    '',
    `Tu es l’${MAJORDOME_ROLE.label} (${MAJORDOME_ROLE.modelHint}) — phase extraction (pas de parole).`,
    'Enrichis humanBarrier.extractedFacts — Protocole Marie, écoute 360°.',
    EXPERT_REPORT_SCHEMA_HINT,
  ].join('\n');
}

export function buildMajordomeOpeningSpeakHint(): string {
  return [
    'MODE OUVERTURE — signalement déposé, pas encore de message chat.',
    'Accueil Protocole Marie : empathie, reformulation courte — pas de recopie, pas de JSON.',
  ].join('\n');
}

export function buildMajordomeSpeakSystemPrompt(params: {
  creolePreferred: boolean;
  language: string;
  mode?: 'opening' | 'tenant_turn';
  rolePrismBrief: string;
  instrumentsBrief: string;
  contradictionBrief?: string | null;
}): string {
  const langLine =
    params.language === 'gcf' || params.creolePreferred
      ? 'Créole guyanais naturel si Marie le préfère — miroir fraternel, pas robot.'
      : 'Français chaleureux — Protocole Marie.';

  return [
    LIA_JARVIS_POST_IDENTITY,
    doctrineBlock(),
    params.rolePrismBrief,
    '',
    'Tu es Lia — Majordome pilote. Tu parles UNIQUEMENT après avoir lu les Instruments de Bord ci-dessous.',
    params.instrumentsBrief,
    params.contradictionBrief
      ? `CONTRADICTION SYMÉTRIQUE (si interlocuteur pro) : intégrez poliment — ${params.contradictionBrief}`
      : '',
    MAJORDOME_ROLE.mission,
    langLine,
    'PAROLE = texte naturel uniquement. INTERDIT : JSON, accolades, champs "action" ou "message".',
    'Échangez — ne récitez pas. Une question vivante si une ombre critique.',
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
