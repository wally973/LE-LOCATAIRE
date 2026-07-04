import type { GrockChatMessage } from './grock.service';

export type GrockDomain =
  | 'CARPENTRY_LOCK'
  | 'PLUMBING_WATER'
  | 'HUMIDITY_ENVELOPE'
  | 'ELECTRICITY'
  | 'GENERAL';

export function inferGrockDomain(input: {
  title: string;
  description: string;
  tenantMessage?: string;
  sessionMessages?: GrockChatMessage[];
  visualPerception?: string | null;
}): GrockDomain[] {
  const text = [
    input.title,
    input.description,
    input.tenantMessage ?? '',
    ...(input.sessionMessages ?? []).map((m) => m.text),
    input.visualPerception ?? '',
  ].join('\n').toLowerCase();

  const domains: GrockDomain[] = [];

  if (/serrure|poignee|gache|porte/.test(text)) {
    domains.push('CARPENTRY_LOCK');
  }

  if (/prise|disjoncteur|electric|courant|ampoule|lumiere/.test(text)) {
    domains.push('ELECTRICITY');
  }

  if (/infiltration|humid|moisiss|salpetre|toit|plafond.*(tache|aureole)/.test(text)) {
    domains.push('HUMIDITY_ENVELOPE');
  }

  if (/fuite|eau|wc|toilet|evier|lavabo|siphon|robinet|canalis/.test(text)) {
    domains.push('PLUMBING_WATER');
  }

  if (domains.length === 0) {
    domains.push('GENERAL');
  }

  return domains;
}

export function buildGrockDomainPrompt(domain: GrockDomain | GrockDomain[]): string {
  const domains = Array.isArray(domain) ? domain : [domain];
  const dominantDomain = domains[0] ?? 'GENERAL';
  const common = [
    '--- Domaine dominant (non verrouillé) ---',
    `Domaine détecté : ${domains.join(', ')}`,
    '- Le domaine détecté est dominant, mais Grock peut mobiliser d’autres métiers si les faits l’exigent.',
    '- Ne jamais ignorer un symptôme qui relève d’un autre métier (ex : eau + électricité, infiltration + menuiserie).',
    '- Le domaine n’est pas un verrou : c’est une priorité de lecture, pas une restriction.',
    '- Si un nouveau sujet apparaît, le noter comme changement possible, mais ne pas bloquer l’enquête.',
  ];

  if (dominantDomain === 'CARPENTRY_LOCK') {
    return [
      ...common,
      'Corps d’état principal : menuiserie / serrurerie.',
      'Symptômes pertinents : porte, serrure, poignée, gâche, pêne, clé, mécanisme bloqué, poignée qui tourne dans le vide.',
      'Ouverture métier : si eau, humidité, infiltration ou déformation liée à l’eau apparaît, mobiliser plomberie ou enveloppe.',
      'Responsabilité : clé perdue → locataire probable ; mécanisme bloqué ou usure → bailleur probable.',
      'Photo utile : poignée, serrure, bord de porte/gâche.',
      'Thinking : domaine dominant menuiserie, mais ouverture si faits d’eau ou d’électricité.',
    ].join('\n');
  }

  if (dominantDomain === 'PLUMBING_WATER') {
    return [
      ...common,
      'Corps d’état principal : plomberie / eau / évacuation.',
      'Ouverture métier : si plafond, façade ou toiture sont cités, mobiliser enveloppe.',
      'Ouverture métier : si eau touche un point lumineux, mobiliser électricité.',
      'Thinking : flux, exutoire, propagation, usage du locataire.',
    ].join('\n');
  }

  if (dominantDomain === 'HUMIDITY_ENVELOPE') {
    return [
      ...common,
      'Corps d’état principal : humidité / enveloppe / toiture-façade.',
      'Ouverture métier : si eau coule dans un équipement ou un siphon, mobiliser plomberie.',
      'Ouverture métier : si infiltration touche un luminaire, mobiliser électricité.',
      'Thinking : dalle froide, condensation, gravité, propagation.',
    ].join('\n');
  }

  if (dominantDomain === 'ELECTRICITY') {
    return [
      ...common,
      'Corps d’état principal : électricité / éclairage.',
      'Ouverture métier : si eau ou humidité sont visibles, mobiliser plomberie ou enveloppe.',
      'Priorité : sécurité.',
      'Thinking : danger, proximité eau + électricité, coupure possible.',
    ].join('\n');
  }

  return [
    ...common,
    'Domaine général : rester strictement attaché aux mots et preuves du locataire.',
  ].join('\n');
}
