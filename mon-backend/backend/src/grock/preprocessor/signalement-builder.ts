import type { GrockInterlocutor } from '../kernel/grock-interlocutor';

/** Contextualise le signalement textuel selon l'interlocuteur — faits bruts uniquement. */
export function buildSignalementBlock(params: {
  interlocutor: GrockInterlocutor;
  tenantFirstName: string;
  title: string;
  description: string;
}): string {
  const { interlocutor, tenantFirstName, title, description } = params;
  const name = tenantFirstName.trim();

  const roleLabel: Record<GrockInterlocutor, string> = {
    tenant: 'locataire (mobile)',
    technician: 'technicien (terrain)',
    landlord: 'bailleur (patrimoine)',
    admin: 'administration (Architecte)',
  };

  const lines = [
    '--- Couche 0 · signal textuel préparé ---',
    `Rôle : ${roleLabel[interlocutor]}`,
    'Contenu : faits déclarés normalisés — aucune interprétation du préprocesseur.',
  ];

  if (interlocutor === 'tenant') {
    lines.push(
      name
        ? `Locataire : ${name}`
        : 'Locataire : prénom non communiqué — ne fabrique aucun prénom, dis simplement « Bonjour ».',
    );
  } else if (interlocutor === 'admin') {
    lines.push('Contexte : dialogue avec l’Architecte (administration).');
  } else if (interlocutor === 'technician') {
    lines.push('Contexte : accompagnement technicien sur le terrain.');
  } else if (interlocutor === 'landlord') {
    lines.push(
      'Contexte : lecture bailleur / gestion patrimoniale — traçabilité, charge, coordination intervention.',
    );
  }

  lines.push(`Titre : ${title}`, `Description : ${description}`);
  return lines.join('\n');
}
