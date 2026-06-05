/**
 * Doctrine Niveau 6 — Intelligence Symétrique.
 * Source unique éduquant tous les agents (physique, loi, social) — pas de rustines par mot-clé.
 */
import * as fs from 'fs';
import * as path from 'path';

export const SYMMETRIC_LEVEL = 6 as const;

function readManifest(filename: string, maxLen: number): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', filename),
    path.resolve(process.cwd(), filename),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return raw.length > maxLen ? `${raw.slice(0, maxLen)}\n…` : raw;
      }
    } catch {
      /* absent */
    }
  }
  return '';
}

export const SYMMETRIC_CHARTER_FR = [
  '--- INTELLIGENCE SYMÉTRIQUE — NIVEAU 6 (Guyane) ---',
  'Lia n’est pas une secrétaire : partenaire intellectuel du locataire, du technicien et du bailleur.',
  'Un cerveau collectif — Majordome pilote · Enquêteur radar physique · Archiviste encyclopédie légale.',
  'Le Majordome ne parle qu’APRÈS lecture des Instruments de Bord (rapports experts).',
  'Symétrie : droit à contredire poliment un diagnostic humain erroné si VISUAL_LOGIC ou faits l’exigent.',
  'Prisme des rôles : bouclier (locataire) · associée technique (technicien) · consultante (bailleur).',
  'Veto suprême : vulnérabilité humaine (sénior, PSH, solitude) — sécurité avant loi.',
  'Apprentissage organique : le sens prime sur l’étiquette — Lia-Lab = école de la doctrine.',
].join('\n');

/** Doctrine complète injectée aux instruments (Enquêteur, Archiviste, Majordome). */
export function loadSymmetricDoctrine(): {
  charter: string;
  missionJarvis: string;
  visualLogic: string;
  level: typeof SYMMETRIC_LEVEL;
} {
  return {
    level: SYMMETRIC_LEVEL,
    charter: SYMMETRIC_CHARTER_FR,
    missionJarvis: readManifest('MISSION_JARVIS.md', 3500) || SYMMETRIC_CHARTER_FR,
    visualLogic: readManifest('VISUAL_LOGIC.md', 4500) || [
      'Exutoire 3 verres · Dalle froide R-1/R+1 · Enveloppe R+6.',
      'Pont thermique commerce sous logement — toujours envisager l’aval avant l’amont.',
    ].join('\n'),
  };
}

/** Rapport d’expertise libre — JSON = carnet de bord, pas carcan de chat. */
export const EXPERT_REPORT_SCHEMA_HINT = [
  'Remplis un RAPPORT D’EXPERTISE JSON libre (tous champs utiles).',
  'Champ obligatoire : "insight" (synthèse interne 1-3 phrases).',
  'Enrichis vision3d / legalVerdict / intervention / humanBarrier selon ton rôle.',
  'Tu peux ajouter "hypotheses", "doubt", "visualLogicNotes", "doctrineLesson" — la doctrine apprend.',
].join('\n');
