import * as fs from 'fs';
import * as path from 'path';
import type { GoldenScenariosFile } from './lia-golden-scenarios.types';

/** Chemin repo : data/golden-scenarios.json */
export function resolveGoldenScenariosPath(): string {
  const fromBackend = path.resolve(
    process.cwd(),
    '..',
    '..',
    'data',
    'golden-scenarios.json',
  );
  if (fs.existsSync(fromBackend)) return fromBackend;
  const fromRoot = path.resolve(process.cwd(), 'data', 'golden-scenarios.json');
  if (fs.existsSync(fromRoot)) return fromRoot;
  return fromBackend;
}

export function loadGoldenScenarios(): GoldenScenariosFile {
  const filePath = resolveGoldenScenariosPath();
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as GoldenScenariosFile;
  if (!parsed.scenarios?.length) {
    throw new Error(`Fichier scénarios or vide ou invalide : ${filePath}`);
  }
  return parsed;
}
