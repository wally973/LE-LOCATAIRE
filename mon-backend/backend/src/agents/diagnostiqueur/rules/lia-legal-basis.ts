/**
 * Références légales systématiques pour le dispatch charge bailleur / locataire.
 */
import { isSavonneuseR1RefoulementSensors } from '../../shared/refoulement-eu-context';
import type { DiagnosticSensors } from '../../shared/lia-diagnostic-state.types';

export function resolveLegalBasisForVerdict(params: {
  responsibility: string;
  category?: string;
  sensors?: DiagnosticSensors;
}): string | null {
  const { responsibility, category, sensors } = params;

  if (responsibility === 'SOCIAL' || responsibility === 'NON_RECEVABLE') {
    return null;
  }
  if (responsibility === 'PENDING' || responsibility === 'ESCALADE_BAILLEUR') {
    return null;
  }

  if (responsibility === 'LOCATAIRE') {
    if (category === 'ELECTRICITY') {
      return (
        'Base légale retenue : décret n°87-712 du 26 janvier 1987 — menues réparations locatives ' +
        '(ampoule, interrupteur, douille accessible, entretien courant des équipements fournis par le locataire).'
      );
    }
    if (category === 'CARPENTRY') {
      return (
        'Base légale retenue : décret n°87-712 du 26 janvier 1987 — entretien courant et menues réparations ' +
        '(réglage de porte, graissage, poignée, joints d’usage, hors cadre structurel ou humidité du bâti).'
      );
    }
    return (
      'Base légale retenue : décret n°87-712 du 26 janvier 1987 ' +
      '(répartition des charges locatives — menues réparations et entretien courant à la charge du locataire).'
    );
  }

  if (responsibility === 'BAILLEUR') {
    if (sensors && isSavonneuseR1RefoulementSensors(sensors)) {
      return (
        'Base légale retenue : article 1719 du Code civil (grosses réparations et entretien des parties communes) ; ' +
        'réseaux collectifs d’évacuation — charge du bailleur.'
      );
    }
    if (category === 'HEATING') {
      return (
        'Base légale retenue : article 1719 du Code civil (entretien et bon fonctionnement du logement décent) ; ' +
        'installation de climatisation fournie ou réseau frigorifique : charge bailleur.'
      );
    }
    if (category === 'ELECTRICITY') {
      return (
        'Base légale retenue : article 1719 du Code civil (installation électrique du logement, parties communes) ; ' +
        'décret n°87-712 exclut les menues réparations locatives lorsque le défaut est structurel ou dangereux.'
      );
    }
    if (category === 'CARPENTRY') {
      return (
        'Base légale retenue : article 1719 du Code civil (menuiseries et bâti) lorsque le cadre, ' +
        'le dormant ou une infiltration structurelle est en cause — hors entretien locatif 87-712.'
      );
    }
    if (category === 'VMC' || category === 'COMMON_AREAS' || category === 'TERMITES') {
      return (
        'Base légale retenue : article 1719 du Code civil (entretien des parties communes et équipements collectifs) ; ' +
        'réseaux et structure : charge bailleur.'
      );
    }
    return (
      'Base légale retenue : article 1719 du Code civil ' +
      '(réparations locatives et grosses réparations à la charge du bailleur).'
    );
  }

  return null;
}
