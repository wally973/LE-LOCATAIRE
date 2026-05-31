import * as fs from 'fs';
import * as path from 'path';

/** Cible dispatch « sixième sens » — technicien référent de secteur. */
export const JARVIS_HANDOFF_TARGET = 'BAILLEUR_SECTOR_TECH' as const;

export const JARVIS_HANDOFF_TENANT_MESSAGE_FR =
  'Cette situation est complexe et nécessite une expertise sur place. ' +
  'J’envoie immédiatement votre dossier au technicien référent de votre secteur.';

const JARVIS_VISUAL_LOGIC_SUMMARY = [
  'Référentiel VISUAL_LOGIC — Intelligence de terrain (Technicien Niveau 5) :',
  '• Exutoire (3 verres) : amont → logement → aval — vérifier la sortie libre avant d’accuser l’intérieur.',
  '• Dalle froide : commerce R-1 froid peut condenser dans logement R+1 au-dessus.',
  '• Enveloppe R+6 : petit défaut toiture terrasse peut affecter menuiserie étages bas.',
  'Protocole Marie : extraction 360° dès le 1er message, jamais redemander, FR ou créole.',
  'panne-diagnostic / DTU / CCTP = base de connaissances pour valider, pas script linéaire.',
].join('\n');

/** Charge VISUAL_LOGIC.md si présent, sinon résumé intégré. */
export function loadVisualLogicBrief(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'VISUAL_LOGIC.md'),
    path.resolve(process.cwd(), 'VISUAL_LOGIC.md'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return raw.length > 4000 ? `${raw.slice(0, 4000)}\n…` : raw;
      }
    } catch {
      /* fichier absent */
    }
  }
  return JARVIS_VISUAL_LOGIC_SUMMARY;
}

/** Charge MISSION_JARVIS.md si présent (manifeste Niveau 5). */
export function loadMissionJarvisBrief(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'MISSION_JARVIS.md'),
    path.resolve(process.cwd(), 'MISSION_JARVIS.md'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return raw.length > 2500 ? `${raw.slice(0, 2500)}\n…` : raw;
      }
    } catch {
      /* fichier absent */
    }
  }
  return [
    'MISSION JARVIS — Lia visualise le bâtiment, ne lit pas de scripts.',
    'Altimétrie, flux physiques, règle exutoire (aval avant amont), enveloppe.',
    'Protocole Marie : empathie, extraction 360°, jamais redemander.',
  ].join('\n');
}

export function jarvisSystemPromptPrefix(): string {
  return [
    'Tu es Lia — Agent de Raisonnement Systémique (Jarvis) pour le logement social en Guyane.',
    loadVisualLogicBrief(),
    '',
    'Protocole Marie : extraction 360°, ne jamais redemander, excuse + explication de ta visualisation si contestation.',
  ].join('\n');
}
