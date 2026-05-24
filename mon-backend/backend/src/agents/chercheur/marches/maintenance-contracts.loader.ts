import * as fs from 'fs';
import * as path from 'path';
import type { MaintenanceContractsCatalog } from './maintenance-contracts.types';

export function maintenanceContractsJsonPath(): string {
  const candidates = [
    path.join(process.cwd(), 'knowledge', 'maintenance-contracts.json'),
    path.join(process.cwd(), '..', '..', 'knowledge', 'maintenance-contracts.json'),
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      '..',
      'knowledge',
      'maintenance-contracts.json',
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Fichier knowledge/maintenance-contracts.json introuvable (cwd=' +
      process.cwd() +
      ')',
  );
}

let cached: MaintenanceContractsCatalog | null = null;

export function loadMaintenanceContracts(
  filePath = maintenanceContractsJsonPath(),
): MaintenanceContractsCatalog {
  const raw = JSON.parse(
    fs.readFileSync(filePath, 'utf8'),
  ) as MaintenanceContractsCatalog;
  cached = raw;
  return raw;
}

export function getMaintenanceContracts(): MaintenanceContractsCatalog {
  return cached ?? loadMaintenanceContracts();
}
