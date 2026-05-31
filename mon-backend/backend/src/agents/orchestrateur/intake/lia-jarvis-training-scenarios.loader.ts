/**
 * Scénarios d'entraînement Jarvis — data/lia-jarvis-entrainement-scenarios.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface TrainingScenarioExpect {
  expectDomain?: string;
  expectActiveFlows?: string[];
  ackMustNotMatch?: string[];
  questionMustMatch?: string[];
  questionMustNotMatch?: string[];
  expectCouncilAgents?: string[];
  expectIntakeComplete?: boolean;
  /** Dette produit connue : question générique « sans tout répéter » tant qu'il n'y a pas de sonde Savoir dédiée. */
  allowsGenericFallbackQuestion?: boolean;
}

export interface TrainingScenario {
  id: string;
  theme: string;
  perimetre: string;
  source: string;
  housingUnit: string;
  title: string;
  description: string;
  opening: TrainingScenarioExpect;
  tenantTurn?: TrainingScenarioExpect & { message: string };
}

interface TrainingCatalog {
  scenarios: TrainingScenario[];
}

let cached: TrainingCatalog | null = null;

function resolveCatalogPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'lia-jarvis-entrainement-scenarios.json'),
    path.join(process.cwd(), '..', '..', 'data', 'lia-jarvis-entrainement-scenarios.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'lia-jarvis-entrainement-scenarios.json introuvable (cwd=' + process.cwd() + ')',
  );
}

export function loadJarvisTrainingScenarios(): TrainingScenario[] {
  if (cached) return cached.scenarios;
  cached = JSON.parse(
    fs.readFileSync(resolveCatalogPath(), 'utf8'),
  ) as TrainingCatalog;
  return cached.scenarios;
}

export interface JuridiqueTrainingScenario extends Omit<TrainingScenario, 'opening' | 'tenantTurn' | 'source'> {
  legalThemeId: string;
  source?: string;
  opening: TrainingScenarioExpect & {
    juristeInsightMustMatch?: string[];
  };
  tenantTurn?: TrainingScenarioExpect & {
    message: string;
    juristeInsightMustMatch?: string[];
  };
}

let cachedJuridique: { scenarios: JuridiqueTrainingScenario[] } | null = null;

function resolveJuridiqueCatalogPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'lia-jarvis-entrainement-juridique.json'),
    path.join(process.cwd(), '..', '..', 'data', 'lia-jarvis-entrainement-juridique.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'lia-jarvis-entrainement-juridique.json introuvable (cwd=' + process.cwd() + ')',
  );
}

export function loadJarvisJuridiqueTrainingScenarios(): JuridiqueTrainingScenario[] {
  if (cachedJuridique) return cachedJuridique.scenarios;
  cachedJuridique = JSON.parse(
    fs.readFileSync(resolveJuridiqueCatalogPath(), 'utf8'),
  ) as { scenarios: JuridiqueTrainingScenario[] };
  return cachedJuridique.scenarios;
}

/** Applique les regex d'assertion sur une chaîne (insensible à la casse). */
export function assertTextPatterns(
  text: string | null | undefined,
  patterns: string[] | undefined,
  mode: 'mustMatch' | 'mustNotMatch',
): void {
  if (!patterns?.length) return;
  const value = text ?? '';
  for (const raw of patterns) {
    const re = new RegExp(raw, 'i');
    if (mode === 'mustMatch') {
      expect(value).toMatch(re);
    } else {
      expect(value).not.toMatch(re);
    }
  }
}
