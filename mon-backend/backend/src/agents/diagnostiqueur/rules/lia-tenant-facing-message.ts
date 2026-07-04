/**
 * Messages locataire (simples) vs synthèse technique (référent / technicien agence).
 */
import type { TicketResponsibility } from '@prisma/client';
import type { LiaIntakeState } from '../../orchestrateur/intake/lia-intake.service';
import { buildLocataireChargeMessage } from './lia-tenant-explanation';
import type { HumidityPhotoAssessment } from '../../../ai-routing/agents/pathologist.types';

export interface TenantFacingMessageInput {
  responsibility: TicketResponsibility | string;
  category: string;
  title: string;
  description: string;
  tenantFirstName?: string;
  intake?: LiaIntakeState | null;
  tenantSupplement?: string;
  /** Message juriste / pipeline déjà orienté locataire (sans synthèse technique). */
  pipelineMessage?: string;
  humidityPhoto?: HumidityPhotoAssessment;
}

/** Texte court affiché au locataire — pas de Savoir-Voir ni bases légales détaillées. */
export function buildTenantFacingMessage(
  input: TenantFacingMessageInput,
): string {
  const name = input.tenantFirstName?.trim() || 'Bonjour';
  const room = input.intake?.signals?.roomHint
    ? ` dans ${input.intake.signals.roomHint}`
    : '';
  const contextText = [
    input.title,
    input.description,
    input.tenantSupplement ?? '',
    ...Object.values(input.intake?.answers ?? {}),
  ]
    .filter(Boolean)
    .join('\n');

  const resp = String(input.responsibility);

  if (resp === 'BAILLEUR' || resp === 'ESCALADE_BAILLEUR') {
    if (isWaterOrHumidityContext(input.category, contextText)) {
      return buildBailleurWaterMessage(name, room, contextText);
    }

    return (
      `${name}, votre demande${room} relève de la charge du bailleur. ` +
      'Nous avons transmis votre dossier à l’agence : le bailleur ou un technicien vous recontactera pour organiser l’intervention. ' +
      'Vous n’avez pas à mandater un artisan partenaire à vos frais.'
    );
  }

  if (resp === 'SOCIAL') {
    return (
      `${name}, votre situation relève du volet social. ` +
      'Un référent dédié va reprendre contact avec vous.'
    );
  }

  if (resp === 'NON_RECEVABLE') {
    return (
      `${name}, ce signalement ne relève pas d’une intervention du bailleur sur le logement. ` +
      'Pour une autre demande, utilisez l’accueil de l’application.'
    );
  }

  if (resp === 'LOCATAIRE') {
    const fromPipeline = input.pipelineMessage?.trim() ?? '';
    if (
      fromPipeline.includes('Diagnostic :') &&
      !fromPipeline.includes('Synthèse de l’analyse')
    ) {
      return stripArtisanCtaFromProse(fromPipeline);
    }
    return stripArtisanCtaFromProse(
      buildLocataireChargeMessage({
        category: input.category,
        contextText,
        humidityPhoto: input.humidityPhoto,
      }),
    );
  }

  return (
    `${name}, nous avons bien enregistré votre signalement. ` +
    'Vous serez informé(e) dès que l’analyse est finalisée.'
  );
}

/** Retire la consigne « boutons Oui/Non artisan » du texte — l’UI Flutter gère les boutons. */
export function stripArtisanCtaFromProse(text: string): string {
  return text
    .replace(
      /Utilisez les boutons Oui \/ Non ci-dessous pour une mise en relation avec un (?:électricien|plombier) partenaire \(devis\), ou continuez sans artisan\.\s*/gi,
      '',
    )
    .replace(
      /Utilisez les boutons Oui \/ Non ci-dessous pour une mise en relation avec un artisan partenaire \(devis\), ou continuez sans artisan\.\s*/gi,
      '',
    )
    .trim();
}

function normalizeForTenantFacing(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function isWaterOrHumidityContext(category: string, contextText: string): boolean {
  const categoryText = normalizeForTenantFacing(category);
  const context = normalizeForTenantFacing(contextText);
  return (
    /humidity|roof|water|plumbing|humidite|toiture|eau|plomberie/.test(categoryText) ||
    /infiltr|fuite|degat.*eau|eau|humid|moisiss|plafond|mur|buanderie|toiture|voisin/.test(
      context,
    )
  );
}

function buildBailleurWaterMessage(
  name: string,
  room: string,
  contextText: string,
): string {
  const context = normalizeForTenantFacing(contextText);
  const possibleAboveOrigin =
    /plafond|haut|dessus|voisin|etage|duplex|toiture|goutte|coule/.test(context);
  const advice = possibleAboveOrigin
    ? 'Si l’eau semble venir du plafond ou d’au-dessus, notez-le et prévenez aussi l’agence si un voisin ou un étage supérieur peut être concerné.'
    : 'Protégez vos affaires et gardez une photo de la zone touchée pour situer précisément l’origine apparente.';

  return (
    `${name}, votre infiltration${room} relève de la charge du bailleur : le dossier est transmis à l’agence. ` +
    `${advice} ` +
    'Si des biens personnels sont abîmés, déclarez aussi le dégât des eaux à votre assurance habitation.'
  );
}
