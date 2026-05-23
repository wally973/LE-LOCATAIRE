/**
 * Messages locataire après diagnostic — explique pourquoi la charge est LOCATAIRE.
 */

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Évier bouché alors que le lavabo est OK (réponses intake ou texte libre). */
export function isSinkBlockageScenario(text: string): boolean {
  const t = normalizeText(text);
  if (!t.includes('evier')) return false;

  const lavaboOk =
    /lavabo.*(bien|normalement|correct)/.test(t) ||
    /coule bien.*lavabo/.test(t) ||
    /dans le lavabo.*(bien|normalement)/.test(t);

  const evierBlocked =
    /evier.*(pas|mal|non|difficile|lent|bouche|encrasse)/.test(t) ||
    /pas bien.*evier/.test(t) ||
    /pas.*dans l.?evier/.test(t) ||
    (/lavabo/.test(t) && /evier/.test(t) && /pas/.test(t));

  return lavaboOk && evierBlocked;
}

function isUnderFixturePlumbing(text: string): boolean {
  const t = normalizeText(text);
  const keywords = [
    'evier',
    'levier',
    'siphon',
    'robinet',
    'flexible',
    'lavabo',
    'fuite sous',
  ];
  const collective = [
    'colonne',
    'parties communes',
    'canalisation encastr',
    'reseau collectif',
    'mur porteur',
  ];
  return (
    keywords.some((k) => t.includes(k)) && !collective.some((k) => t.includes(k))
  );
}

import {
  parseElectricitySignals,
  resolveElectricityCharge,
} from './lia-electricity-rules';
import { isTenantBricolageContext } from './lia-humidity-rules';
import type { HumidityPhotoAssessment } from '../ai-routing/agents/pathologist.types';

const PLUMBER_CTA =
  'Utilisez les boutons Oui / Non ci-dessous pour une mise en relation avec un plombier partenaire (devis), ou continuez sans artisan.';

const ELECTRICIAN_CTA =
  'Utilisez les boutons Oui / Non ci-dessous pour une mise en relation avec un électricien partenaire (devis), ou continuez sans artisan.';

/** Message clair pour charge locataire (plomberie évier / bouchon). */
export function buildLocataireChargeMessage(params: {
  category: string;
  contextText: string;
  humidityPhoto?: HumidityPhotoAssessment;
}): string {
  const { category, contextText, humidityPhoto } = params;

  if (category === 'PLUMBING' && isSinkBlockageScenario(contextText)) {
    return (
      'Diagnostic : l’eau s’écoule normalement au lavabo, mais pas à l’évier. ' +
      'Le problème est donc localisé à l’évier (siphon, bonde ou canalisation sous l’évier), ' +
      'souvent un bouchon ou un encrassement — pas une canalisation collective du bailleur.\n\n' +
      'Pourquoi à votre charge ? Ce type d’entretien relève des menues réparations / entretien locatif ' +
      '(décret 87-712) : c’est à vous de faire déboucher ou faire intervenir un plombier à vos frais, ' +
      'comme pour un entretien courant de votre logement.\n\n' +
      'Ce n’est pas une intervention que le bailleur doit prendre en charge tant que le lavabo et le réseau général fonctionnent.\n\n' +
      PLUMBER_CTA
    );
  }

  if (category === 'PLUMBING' && isUnderFixturePlumbing(contextText)) {
    return (
      'Diagnostic : le problème concerne l’évier, le lavabo ou la robinetterie sous votre équipement ' +
      '(siphon, flexible, fuite localisée), pas une canalisation collective du logement.\n\n' +
      'Pourquoi à votre charge ? L’entretien courant et les menues réparations sous l’évier ' +
      'sont à la charge du locataire (décret 87-712). Vous pouvez faire intervenir un plombier à vos frais.\n\n' +
      PLUMBER_CTA
    );
  }

  if (category === 'HUMIDITY') {
    const bricolage = isTenantBricolageContext(contextText);
    const photoOk =
      humidityPhoto &&
      !humidityPhoto.structuralDegradationVisible &&
      humidityPhoto.tenantSurfaceNeglectOnly;
    return (
      'Diagnostic : humidité ou moisissures dans la pièce, sans dégradation structurelle manifeste visible sur la photo ' +
      '(pas de fissure, infiltration ni remontée capillaire évidente).\n\n' +
      (bricolage
        ? 'Vous avez déjà essayé d’intervenir (entretien / bricolage) : cela reste en principe de l’entretien locatif (ventilation, traitement de surface, limitation des sources d’humidité).\n\n'
        : 'Pourquoi à votre charge ? Moisissure localisée, condensation ou entretien courant relèvent des menues réparations / bon usage du logement (décret 87-712), surtout en climat humide.\n\n') +
      (photoOk
        ? 'La photo confirme une atteinte de surface plutôt que du gros œuvre : le bailleur n’est pas tenu de reprendre ce type d’entretien.\n\n'
        : '') +
      'Vous pouvez poursuivre aération quotidienne et traitement adapté ; un artisan reste possible à vos frais si besoin.'
    );
  }

  if (category === 'ELECTRICITY') {
    const signals = parseElectricitySignals(contextText);
    const charge = resolveElectricityCharge(signals);
    if (charge === 'BAILLEUR') {
      return (
        'Diagnostic : le problème concerne l’installation électrique du logement ' +
        '(tableau, circuit qui ne tient pas, ou coupure générale), pas une simple menue réparation.\n\n' +
        'Cette intervention relève du bailleur. Un agent va vous recontacter pour organiser la suite.\n\n' +
        'En attendant, ne touchez pas à des fils dénudés ni à une installation qui sent le brûlé — coupez le disjoncteur si c’est sans danger.'
      );
    }
    if (signals.localizedLighting && signals.bulbAlreadyChanged) {
      if (signals.switchWorks === false) {
        return (
          'Diagnostic : l’ampoule a déjà été changée mais l’interrupteur de la pièce ne fonctionne pas correctement.\n\n' +
          'Pourquoi à votre charge ? Le remplacement d’un interrupteur ou l’entretien d’un point lumineux accessible ' +
          'relève des menues réparations (décret 87-712), comme l’ampoule.\n\n' +
          ELECTRICIAN_CTA
        );
      }
      if (signals.douilleWear === true) {
        return (
          'Diagnostic : l’ampoule a été changée ; le support ou la douille présente des signes d’usure.\n\n' +
          'Pourquoi à votre charge ? L’entretien du support d’ampoule accessible est une réparation locative courante. ' +
          'Si le disjoncteur du circuit ne tient pas en position, contactez le bailleur (installation fixe).\n\n' +
          ELECTRICIAN_CTA
        );
      }
      return (
        'Diagnostic : éclairage localisé dans une pièce, ampoule déjà remplacée ; interrupteur et disjoncteur du circuit semblent corrects.\n\n' +
        'Pourquoi à votre charge ? Tant qu’il s’agit d’éléments accessibles (ampoule, interrupteur, douille), ' +
        'c’est de l’entretien locatif. Si un électricien constate un défaut sur le câblage encastré, le bailleur reprendra la charge.\n\n' +
        ELECTRICIAN_CTA
      );
    }
    if (signals.localizedLighting && !signals.bulbAlreadyChanged) {
      return (
        'Diagnostic : panne d’éclairage dans une seule pièce.\n\n' +
        'Pourquoi à votre charge ? Le remplacement d’ampoules et l’entretien courant des points lumineux ' +
        'sont des réparations locatives (décret 87-712). Commencez par une ampoule neuve adaptée ; ' +
        'si le problème persiste après contrôle de l’interrupteur et du disjoncteur du circuit, précisez-le dans le fil.\n\n' +
        ELECTRICIAN_CTA
      );
    }
  }

  if (category === 'ELECTRICITY') {
    return (
      'Diagnostic : ce type d’intervention relève de l’entretien locatif (à votre charge), pas du bailleur.\n\n' +
      'Vous pouvez faire intervenir un électricien à vos frais si nécessaire. ' +
      ELECTRICIAN_CTA
    );
  }

  return (
    'Diagnostic : ce type d’intervention relève de l’entretien locatif (à votre charge), pas du bailleur.\n\n' +
    'Vous pouvez faire intervenir un artisan à vos frais si nécessaire. ' +
    PLUMBER_CTA
  );
}
