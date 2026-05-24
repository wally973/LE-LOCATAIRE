import * as fs from 'fs';
import * as path from 'path';
import type { MasterDiagnosticCatalog } from './master-diagnostic-rules.types';

export function masterDiagnosticRulesJsonPath(): string {
  const candidates = [
    path.join(process.cwd(), 'knowledge', 'master-diagnostic-rules.json'),
    path.join(process.cwd(), '..', '..', 'knowledge', 'master-diagnostic-rules.json'),
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      '..',
      'knowledge',
      'master-diagnostic-rules.json',
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Fichier knowledge/master-diagnostic-rules.json introuvable (cwd=' +
      process.cwd() +
      ')',
  );
}

let cached: MasterDiagnosticCatalog | null = null;

export function loadMasterDiagnosticRules(
  filePath = masterDiagnosticRulesJsonPath(),
): MasterDiagnosticCatalog {
  const raw = JSON.parse(
    fs.readFileSync(filePath, 'utf8'),
  ) as MasterDiagnosticCatalog;
  cached = raw;
  return raw;
}

export function getMasterDiagnosticRules(): MasterDiagnosticCatalog {
  return cached ?? loadMasterDiagnosticRules();
}
