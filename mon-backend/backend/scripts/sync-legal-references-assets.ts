/**
 * Copie data/legal-references.json vers l’asset Flutter (offline).
 *   npx ts-node scripts/sync-legal-references-assets.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { legalReferencesJsonPath } from '../src/legal-references/legal-reference.loader';

const source = legalReferencesJsonPath();
const target = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'mobile',
  'flutter',
  'assets',
  'legal',
  'legal_references.json',
);

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`Copié :\n  ${source}\n  → ${target}`);
