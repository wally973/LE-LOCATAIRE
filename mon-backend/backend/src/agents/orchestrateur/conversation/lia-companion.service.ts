import { Injectable, Logger, Optional } from '@nestjs/common';
import { LegalReferencesService } from '../../../legal-references/legal-references.service';
import { EXPERT_COMPAGNON_SYSTEM_PROMPT } from '../prompts/expert-compagnon.prompt';
import { LiaHostService } from './lia-host.service';
import type { IntakeCategory } from '../intake/lia-intake.service';
import { isSkipPhotoIntent } from './lia-agent-intents';
import {
  type CompanionLanguage,
  type CompanionResponse,
  type CompanionSafetyLevel,
} from './lia-companion.types';

@Injectable()
export class LiaCompanionService {
  private readonly logger = new Logger(LiaCompanionService.name);

  constructor(
    private readonly host: LiaHostService,
    @Optional() private readonly legalRefs?: LegalReferencesService,
  ) {}

  /**
   * Produit une guidance Expert-Compagnon (LLM JSON ou règles métier).
   */
  async produceGuidance(params: {
    title: string;
    description: string;
    category: IntakeCategory;
    tenantFirstName?: string;
    tenantMessage?: string;
    effectiveResponsibility?: string;
  }): Promise<CompanionResponse> {
    const query = `${params.title} ${params.description} ${params.tenantMessage ?? ''}`;
    const legalSnippets = this.legalRefs
      ? await this.legalRefs.search({
          query,
          category: params.category,
          limit: 3,
        })
      : [];
    const legalBlock =
      legalSnippets.length > 0
        ? legalSnippets
            .map(
              (h, i) =>
                `[J${i + 1}] (${h.kind}/${h.category}) ${h.title}\n${h.summary}\n${h.content.slice(0, 600)}`,
            )
            .join('\n\n')
        : '';

    const userPrompt = [
      `Prénom locataire : ${params.tenantFirstName?.trim() || '—'}`,
      `Catégorie intake : ${params.category}`,
      `Signalement : ${params.title}`,
      `Description : ${params.description}`,
      params.tenantMessage ? `Dernier message : ${params.tenantMessage}` : '',
      legalBlock ? `Extraits juridiques internes :\n${legalBlock}` : '',
      'Produis le JSON Expert-Compagnon pour ce cas.',
    ]
      .filter(Boolean)
      .join('\n');

    const raw = await this.host.chatStructured(
      EXPERT_COMPAGNON_SYSTEM_PROMPT,
      userPrompt,
      520,
    );
    if (raw) {
      const parsed = this.parseCompanionJson(raw);
      if (parsed) return parsed;
    }

    return this.fallbackRules({
      ...params,
      tenantMessage: params.tenantMessage,
      effectiveResponsibility: params.effectiveResponsibility,
    });
  }

  private parseCompanionJson(raw: string): CompanionResponse | null {
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<CompanionResponse>;
      if (!obj.speech || typeof obj.speech !== 'string') return null;
      return {
        speech: obj.speech.trim(),
        language: this.normalizeLanguage(obj.language),
        avatar_action: obj.avatar_action ?? 'GESTURE:nod',
        avatar_position: obj.avatar_position ?? 'bottom_right',
        search_trigger:
          typeof obj.search_trigger === 'string' ? obj.search_trigger : null,
        safety_level: this.normalizeSafety(obj.safety_level),
        photo_requested: Boolean(obj.photo_requested),
        landlord_hint: obj.landlord_hint ?? null,
        photo_guidance_steps: Array.isArray(obj.photo_guidance_steps)
          ? obj.photo_guidance_steps.map(String).slice(0, 4)
          : [],
      };
    } catch (e) {
      this.logger.warn('JSON Expert-Compagnon invalide', e);
      return null;
    }
  }

  private fallbackRules(params: {
    title: string;
    description: string;
    category: IntakeCategory;
    tenantFirstName?: string;
    tenantMessage?: string;
    effectiveResponsibility?: string;
  }): CompanionResponse {
    const text = `${params.title} ${params.description} ${params.tenantMessage ?? ''}`.toLowerCase();
    const name = params.tenantFirstName?.trim() || 'Bonjour';

    if (params.tenantMessage && isSkipPhotoIntent(params.tenantMessage)) {
      return {
        speech: `${name}, pas de souci pour la caméra. Utilisez « Galerie » si possible, sinon je m’appuie sur votre description pour le diagnostic.`,
        language: 'fr',
        avatar_action: 'GESTURE:nod',
        avatar_position: 'bottom_right',
        search_trigger: null,
        safety_level: 'yellow',
        photo_requested: false,
        landlord_hint: 'NUANCE',
        photo_guidance_steps: [],
      };
    }

    if (
      params.effectiveResponsibility === 'BAILLEUR' ||
      params.effectiveResponsibility === 'ESCALADE_BAILLEUR'
    ) {
      return {
        speech: `${name}, c’est bien pris en charge par le bailleur. Un technicien de l’agence vous recontactera — pas besoin d’artisan partenaire.`,
        language: 'fr',
        avatar_action: 'GESTURE:nod',
        avatar_position: 'bottom_right',
        search_trigger: null,
        safety_level: 'green',
        photo_requested: false,
        landlord_hint: 'BAILLEUR',
        photo_guidance_steps: [],
      };
    }

    const solo = (params.tenantMessage ?? '').trim();
    if (
      /^(bonjou|bonswa|alo)\b[!?.]*$/i.test(solo) ||
      (/^(bonjou|bonswa|alo)\b/i.test(solo) && solo.length < 40 && !/clim|fuite|eau/i.test(text))
    ) {
      return {
        speech: `Bonjou ${name} ! Mwen ka edé aw — rakonté mwen sa ki pa bon anndan logement-la.`,
        language: 'gcf',
        avatar_action: 'GESTURE:wave',
        avatar_position: 'center',
        search_trigger: null,
        safety_level: 'green',
        photo_requested: false,
        landlord_hint: null,
        photo_guidance_steps: [],
      };
    }

    let safety_level: CompanionSafetyLevel = 'green';
    let avatar_action = 'GESTURE:nod';
    if (
      /fil(s)?\s*d[eé]nud|odeur de brûl|odeur de brul|étincelle|arc électri|gaz|fumée noire/i.test(
        text,
      )
    ) {
      safety_level = 'red';
      avatar_action = 'GESTURE:safety_stop';
    } else if (/fuite|eau|coule|infiltrat|inond/i.test(text)) {
      safety_level = 'yellow';
      avatar_action = 'GESTURE:think';
    }

    const photo_requested =
      params.category !== 'GENERIC' || /photo|voir|cadre/i.test(text);

    let landlord_hint: CompanionResponse['landlord_hint'] = 'NUANCE';
    let photo_guidance_steps: string[] = [];
    if (params.category === 'ROOF') {
      landlord_hint = 'BAILLEUR';
      photo_guidance_steps = [
        'Cadrez les taches ou gouttes au plafond',
        'Montrez un coin de la pièce pour situer l’endroit',
      ];
      return {
        speech:
          safety_level === 'red'
            ? `${name}, coupez l’électricité si des fils sont touchés par l’eau, puis appelez les secours si besoin. Ensuite prévenez le bailleur.`
            : `${name}, protégez vos affaires (bâche, seaux). Une fuite de toiture relève en principe du bailleur. Faites une photo pour le technicien.`,
        language: 'fr',
        avatar_action,
        avatar_position: 'bottom_right',
        search_trigger: null,
        safety_level,
        photo_requested: true,
        landlord_hint,
        photo_guidance_steps,
      };
    }

    if (params.category === 'ELECTRICITY') {
      photo_guidance_steps = [
        'Photo du disjoncteur ou tableau (sans toucher les fils)',
        'Photo de la zone en panne (prise, lampe)',
      ];
      return {
        speech: `${name}, ne touchez pas une installation abîmée. Coupez le circuit au disjoncteur si vous savez lequel, puis envoyez une photo.`,
        language: 'fr',
        avatar_action: 'GESTURE:point_at_camera',
        avatar_position: 'bottom_right',
        search_trigger: null,
        safety_level,
        photo_requested: true,
        landlord_hint: 'NUANCE',
        photo_guidance_steps,
      };
    }

    if (/clim|climatisation|split|condensat/i.test(text)) {
      return {
        speech: `${name}, an saison sèch, séki souvent condensats ou fuite frigo — pa toiture. Fè yon foto anba split-la.`,
        language: 'gcf',
        avatar_action: 'GESTURE:point_at_camera',
        avatar_position: 'bottom_right',
        search_trigger: null,
        safety_level: 'yellow',
        photo_requested: true,
        landlord_hint: 'NUANCE',
        photo_guidance_steps: [
          'Cadrez l’eau sous l’unité intérieure',
          'Montrez le bac à condensats si visible',
        ],
      };
    }

    if (params.category === 'PLUMBING') {
      photo_guidance_steps = ['Photo nette du point qui fuit', 'Vue d’ensemble du meuble ou pièce'];
      return {
        speech: `${name}, limitez les dégâts (seau, couper l’eau si possible). Envoyez une photo du problème pour le dossier.`,
        language: 'fr',
        avatar_action: 'GESTURE:point_at_camera',
        avatar_position: 'bottom_right',
        search_trigger: null,
        safety_level,
        photo_requested: true,
        landlord_hint: 'NUANCE',
        photo_guidance_steps,
      };
    }

    return {
      speech: `${name}, je vais vous guider pas à pas. Décrivez ou photographiez le problème.`,
      language: 'fr',
      avatar_action: 'GESTURE:wave',
      avatar_position: 'center',
      search_trigger: null,
      safety_level,
      photo_requested,
      landlord_hint,
      photo_guidance_steps: photo_requested
        ? ['Cadrez la zone concernée', 'Évitez le contre-jour']
        : [],
    };
  }

  private normalizeSafety(v: unknown): CompanionSafetyLevel {
    if (v === 'red' || v === 'yellow' || v === 'green') return v;
    return 'green';
  }

  private normalizeLanguage(v: unknown): CompanionLanguage {
    const allowed: CompanionLanguage[] = ['fr', 'gcf', 'hat', 'es', 'en', 'pt'];
    if (typeof v === 'string' && (allowed as string[]).includes(v)) {
      return v as CompanionLanguage;
    }
    return 'fr';
  }
}
