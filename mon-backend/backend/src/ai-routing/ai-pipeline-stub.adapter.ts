import { Injectable } from '@nestjs/common';
import {
  AiPipelineDecision,
  AiPipelineInput,
  AiPipelinePort,
} from './ai-pipeline.port';

/**
 * Adapter stub déterministe — Sprint 3.
 *
 * Objectif : pouvoir tester intégralement le routage côté backend / contrats API
 * sans dépendance externe (et sans coût LLM). On le remplace par un adapter
 * OpenAI/Gemini au Sprint 7.
 *
 * Heuristiques basées sur mots-clés FR (les langues additionnelles, créole, espagnol,
 * portugais brésilien, seront branchées via traduction côté futur LLM).
 */
@Injectable()
export class AiPipelineStubAdapter implements AiPipelinePort {
  async analyze(input: AiPipelineInput): Promise<AiPipelineDecision> {
    const raw = `${input.title} ${input.description} ${input.tenantFeedback ?? ''}`;
    const text = raw.toLowerCase();
    const steps: AiPipelineDecision['pipelineSteps'] = [];

    // --- 1) Détection signal social (prioritaire) ----------------------------
    const socialKeywords = [
      'impay',
      'pas payer',
      'pas payé',
      'pas pu payer',
      'difficult',
      'rsa',
      'surendett',
      'caf',
      'aide sociale',
      'fin de mois',
    ];
    const hasSocial = socialKeywords.some((k) => text.includes(k));
    if (hasSocial) {
      steps.push({
        name: 'social_detection',
        decision: 'SOCIAL',
        confidence: 0.9,
      });
      return {
        responsibility: 'SOCIAL',
        category: 'SOCIAL',
        severity: 'MEDIUM',
        confidence: 0.9,
        needsMorePhoto: false,
        socialFlag: true,
        message:
          'Votre situation va être transmise à un référent social du bailleur. ' +
          'Vous serez recontacté(e) prochainement.',
        pipelineSteps: steps,
      };
    }

    // --- 2) Détection NON_RECEVABLE -----------------------------------------
    if (
      text.includes('voisin') &&
      (text.includes('bruit') ||
        text.includes('dispute') ||
        text.includes('insulte') ||
        text.includes('harc'))
    ) {
      steps.push({
        name: 'non_recevable_check',
        decision: 'JURIDIQUE_VOISIN',
        confidence: 0.85,
      });
      return {
        responsibility: 'NON_RECEVABLE',
        nonRecevableReason: 'JURIDIQUE_VOISIN',
        category: 'OTHER',
        severity: 'LOW',
        confidence: 0.85,
        needsMorePhoto: false,
        socialFlag: false,
        message:
          'Ce type de litige relève du juridique et non du bailleur. ' +
          'Nous vous invitons à vous rapprocher de la mairie ou du conciliateur de justice.',
        pipelineSteps: steps,
      };
    }
    if (
      text.includes('dégâts des eaux') ||
      text.includes('degats des eaux') ||
      (text.includes('assurance') && text.includes('eau'))
    ) {
      steps.push({
        name: 'non_recevable_check',
        decision: 'ASSURANCE_DEGATS_EAUX',
        confidence: 0.8,
      });
      return {
        responsibility: 'NON_RECEVABLE',
        nonRecevableReason: 'ASSURANCE_DEGATS_EAUX',
        category: 'WATER_DAMAGE',
        severity: 'MEDIUM',
        confidence: 0.8,
        needsMorePhoto: false,
        socialFlag: false,
        message:
          'Un dégât des eaux relève de votre assurance habitation. ' +
          'Déclarez le sinistre à votre assureur ; le bailleur sera tenu informé.',
        pipelineSteps: steps,
      };
    }

    // --- 3) Détection besoin photo / description trop courte ----------------
    const tooShort = input.description.trim().length < 15;
    const hasNoPhoto = input.photoUrls.length === 0;
    if (
      input.attempt === 1 &&
      tooShort &&
      hasNoPhoto &&
      !input.tenantFeedback
    ) {
      steps.push({
        name: 'photo_needed_check',
        decision: 'NEEDS_MORE_PHOTO',
        confidence: 0.5,
      });
      return {
        responsibility: 'PENDING',
        category: 'UNKNOWN',
        severity: 'LOW',
        confidence: 0.4,
        needsMorePhoto: true,
        socialFlag: false,
        message:
          'Pouvez-vous prendre une photo claire du problème et décrire en quelques mots ce qui se passe ?',
        pipelineSteps: steps,
      };
    }

    // --- 4) Classification technique ----------------------------------------
    type Bucket = {
      category: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      keywords: string[];
      severityBoost: string[];
      bailleurHints: string[];
      artisanType?: string;
    };
    const buckets: Bucket[] = [
      {
        category: 'PLUMBING',
        severity: 'MEDIUM',
        keywords: ['fuite', 'plomberie', 'robinet', 'tuyau', 'wc', 'toilette'],
        severityBoost: ['inondation', 'urgence', 'éclat'],
        bailleurHints: ['canalisation', 'colonne'],
        artisanType: 'PLUMBER',
      },
      {
        category: 'ELECTRICITY',
        severity: 'MEDIUM',
        keywords: ['électric', 'electric', 'prise', 'court-circuit', 'disjonct'],
        severityBoost: ['étincelle', 'brûle', 'incendie', 'fumée'],
        bailleurHints: ['tableau', 'compteur', 'colonne'],
        artisanType: 'ELECTRICIAN',
      },
      {
        category: 'HUMIDITY',
        severity: 'MEDIUM',
        keywords: ['moisissure', 'humidit', 'champignon', 'condens'],
        severityBoost: ['plafond', 'mur entier'],
        bailleurHints: ['toiture', 'gros œuvre', 'gros oeuvre', 'façade'],
      },
      {
        category: 'LOCK',
        severity: 'LOW',
        keywords: ['serrure', 'clé perdue', 'clef perdue', 'porte ne ferme'],
        severityBoost: [],
        bailleurHints: ['porte palière', 'porte paliere', 'palier'],
        artisanType: 'LOCKSMITH',
      },
      {
        category: 'HEATING',
        severity: 'MEDIUM',
        keywords: ['chauffage', 'radiateur', 'chauffe-eau', 'ballon eau chaude'],
        severityBoost: ['pas d eau chaude', 'aucune chaleur'],
        bailleurHints: ['chaufferie', 'collectif'],
        artisanType: 'HEATING_TECH',
      },
    ];

    let chosen: Bucket | null = null;
    for (const b of buckets) {
      if (b.keywords.some((k) => text.includes(k))) {
        chosen = b;
        break;
      }
    }

    if (!chosen) {
      steps.push({
        name: 'classification',
        decision: 'NO_MATCH',
        confidence: 0.3,
      });
      // 2e tentative sans match clair → escalade
      if (input.attempt >= 2) {
        return {
          responsibility: 'ESCALADE_BAILLEUR',
          category: 'OTHER',
          severity: 'LOW',
          confidence: 0.3,
          needsMorePhoto: false,
          socialFlag: false,
          message:
            'Nous n’arrivons pas à qualifier précisément votre demande. ' +
            'Un agent du bailleur va prendre le relais et vous recontacter.',
          pipelineSteps: steps,
        };
      }
      return {
        responsibility: 'PENDING',
        category: 'OTHER',
        severity: 'LOW',
        confidence: 0.3,
        needsMorePhoto: true,
        socialFlag: false,
        message:
          'Pouvez-vous préciser davantage votre demande ou ajouter une photo ?',
        pipelineSteps: steps,
      };
    }

    // Sévérité (boost si mot-clé d'urgence détecté)
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' = chosen.severity;
    if (chosen.severityBoost.some((k) => text.includes(k))) severity = 'HIGH';

    const isBailleurHint = chosen.bailleurHints.some((k) => text.includes(k));
    const confidence =
      0.75 + (chosen.keywords.filter((k) => text.includes(k)).length - 1) * 0.05;
    const cappedConfidence = Math.min(0.95, confidence);

    steps.push({
      name: 'classification',
      decision: chosen.category,
      confidence: cappedConfidence,
      extra: { severity, bailleurHint: isBailleurHint },
    });

    if (isBailleurHint || severity === 'HIGH') {
      return {
        responsibility: 'BAILLEUR',
        category: chosen.category,
        severity,
        confidence: cappedConfidence,
        needsMorePhoto: false,
        socialFlag: false,
        message:
          severity === 'HIGH'
            ? 'Urgent : un agent du bailleur a été notifié immédiatement.'
            : 'Cette intervention relève du bailleur ; un agent va vous recontacter.',
        pipelineSteps: steps,
      };
    }

    return {
      responsibility: 'LOCATAIRE',
      category: chosen.category,
      severity,
      confidence: cappedConfidence,
      needsMorePhoto: false,
      socialFlag: false,
      suggestedArtisanType: chosen.artisanType,
      message:
        `Ce type d’intervention relève de l’entretien locatif (à votre charge). ` +
        `Vous pouvez répondre ici, par exemple « je veux un plombier », ` +
        `pour être mis(e) en relation avec un artisan partenaire — un devis vous sera proposé.`,
      pipelineSteps: steps,
    };
  }
}
