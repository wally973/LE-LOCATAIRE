/**
 * Savoir métier logement social — fiches opérationnelles de ventilation.
 * Aucun arbre de décision : ce bloc donne à Grock des repères métier à raisonner.
 */
import * as fs from 'fs';
import * as path from 'path';

const OPERATIONAL_FICHE_FILES = [
  'metier-parties-privatives-vs-parties-communes.md',
  'metier-role-responsable-cite.md',
  'metier-role-gardien-agent-proximite.md',
  'metier-role-technicien.md',
  'metier-menus-travaux-vs-travaux-techniques.md',
  'metier-traitement-nuisances.md',
  'metier-circuit-traitement-demandes.md',
  'assurances-habitation-sinistres-recours.md',
  'risques-naturels-guyane-pprn-assurance.md',
] as const;

function existingLibraryPath(): string {
  const candidates = [
    path.join(process.cwd(), 'bibliotheque-juridique'),
    path.join(process.cwd(), '..', '..', 'bibliotheque-juridique'),
    path.resolve(__dirname, '..', '..', '..', '..', 'bibliotheque-juridique'),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      'Dossier bibliotheque-juridique introuvable (cwd=' + process.cwd() + ')',
    );
  }

  return found;
}

function compactMarkdown(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !trimmed.startsWith('Source professionnelle :') &&
        !trimmed.startsWith('Date de publication :') &&
        !trimmed.startsWith('Version :') &&
        !trimmed.startsWith('## Références')
      );
    })
    .join('\n')
    .trim();
}

export function loadGrockSocialHousingOperationsBlock(): string {
  try {
    const libraryPath = existingLibraryPath();
    const lines: string[] = [
      '--- Savoir métier logement social : ventilation des réclamations ---',
      'Objectif interne : distinguer privatif / commun / menu travail / travail technique / nuisance / sécurité, puis orienter vers gardien, responsable de cité, technicien ou bailleur/admin.',
      'Ne récite pas ces fiches au locataire. Utilise-les dans thinking pour qualifier le périmètre, la responsabilité opérationnelle et la prochaine action.',
      'Question pivot si le périmètre est flou : est-ce que cela sert seulement votre logement, ou plusieurs logements / la résidence ?',
    ];

    for (const file of OPERATIONAL_FICHE_FILES) {
      const filePath = path.join(libraryPath, file);
      if (!fs.existsSync(filePath)) continue;
      lines.push('', compactMarkdown(fs.readFileSync(filePath, 'utf8')));
    }

    return lines.join('\n').trim();
  } catch {
    return [
      '--- Savoir métier logement social ---',
      'Fiches opérationnelles indisponibles ; conserver la distinction métier : privatif, commun, menu travail, technique, nuisance, sécurité.',
    ].join('\n');
  }
}
