import * as fs from 'fs';
import * as path from 'path';
import type { LegalReferencesCatalogDto } from './legal-reference.types';

/** Chemin du fichier source (racine repo `data/legal-references.json`). */
export function legalReferencesJsonPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'legal-references.json'),
    path.join(process.cwd(), '..', '..', 'data', 'legal-references.json'),
    path.resolve(__dirname, '..', '..', '..', '..', 'data', 'legal-references.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    'Fichier data/legal-references.json introuvable (cwd=' + process.cwd() + ')',
  );
}

export function loadLegalReferencesCatalogFromFile(
  filePath = legalReferencesJsonPath(),
): LegalReferencesCatalogDto {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as LegalReferencesCatalogDto;
}
