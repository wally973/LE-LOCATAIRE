import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { AiPipelineInput } from '../ai-pipeline.port';
import { parseJsonFromLlm } from '../utils/llm-json.util';
import type {
  HvacPhotoAssessment,
  HumidityPhotoAssessment,
  PathologistResult,
} from './pathologist.types';
import { inferHumidityPhotoFromText } from '../../agents/diagnostiqueur/rules/lia-humidity-rules';
import {
  inferHvacPhotoCuesFromText,
  isHvacSignalement,
  runHvacDifferential,
  type HvacPhotoCues,
} from '../../agents/diagnostiqueur/rules/lia-hvac-pathology';
import { DiagnosticContextService } from '../../agents/shared/diagnostic-context.service';
import type { DiagnosticSensors } from '../../agents/shared/lia-diagnostic-state.types';

interface GeminiPathologistJson {
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  needsMorePhoto: boolean;
  observation: string;
  suggestedArtisanType?: string;
  structuralDegradationVisible?: boolean;
  tenantSurfaceNeglectOnly?: boolean;
  humidityIndicators?: string[];
  darkHaloVisible?: boolean;
  condensateOverflowVisible?: boolean;
  refrigerantOilResidue?: boolean;
  stainUnderIndoorUnit?: boolean;
  hvacIndicators?: string[];
}

/**
 * Agent pathologiste — vision + DiagnosticContextService (plus de stub photo séparé).
 */
@Injectable()
export class LiaPathologistService {
  private readonly logger = new Logger(LiaPathologistService.name);

  constructor(private readonly diagnosticContext: DiagnosticContextService) {}

  async analyze(input: AiPipelineInput): Promise<PathologistResult> {
    const enriched = await this.enrichInput(input);
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && process.env.LIA_PATHOLOGIST_ENABLED !== 'false') {
      try {
        return await this.analyzeWithGemini(enriched, apiKey);
      } catch (e) {
        this.logger.warn('Gemini pathologiste indisponible, fallback simulation', e);
      }
    }
    return this.analyzeSimulated(enriched);
  }

  /**
   * Analyse d’une photo pour un ticket (ex-ai-photo.service) — contexte capteurs inclus.
   */
  async analyzePhotoForTicket(
    ticketId: number,
    photoUrl: string,
    extraUrls: string[] = [],
  ): Promise<PathologistResult> {
    const ctx = await this.diagnosticContext.fromTicket(ticketId);
    return this.analyze({
      title: ctx.title,
      description: ctx.description,
      attempt: 1,
      photoUrls: [photoUrl, ...extraUrls].filter(Boolean),
      caseContextForRules: ctx.caseContext,
      diagnosticSensors: ctx.sensors,
      ticketId,
      locale: 'fr-FR',
    });
  }

  private async enrichInput(input: AiPipelineInput): Promise<AiPipelineInput> {
    if (input.diagnosticSensors && Object.keys(input.diagnosticSensors).length > 0) {
      return input;
    }
    if (input.ticketId) {
      const ctx = await this.diagnosticContext.fromTicket(input.ticketId);
      return {
        ...input,
        diagnosticSensors: ctx.sensors,
        caseContextForRules: input.caseContextForRules ?? ctx.caseContext,
      };
    }
    return {
      ...input,
      diagnosticSensors: {},
    };
  }

  private async analyzeWithGemini(
    input: AiPipelineInput,
    apiKey: string,
  ): Promise<PathologistResult> {
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    const sensors = input.diagnosticSensors ?? {};
    const parts: Array<Record<string, unknown>> = [
      {
        text: [
          'Tu es un pathologiste du bâtiment pour un bailleur social en Guyane.',
          'Analyse la description et les photos (si présentes).',
          `Titre: ${input.title}`,
          `Description: ${input.description}`,
          input.tenantFeedback ? `Précision locataire: ${input.tenantFeedback}` : '',
          sensors.weather_context
            ? `Contexte météo capteur: ${sensors.weather_context}`
            : '',
          `Tentative n°${input.attempt}.`,
          'Réponds UNIQUEMENT en JSON valide avec les clés:',
          'category (PLUMBING|ELECTRICITY|HUMIDITY|HEATING|LOCK|WATER_DAMAGE|SOCIAL_SIGNAL|OTHER),',
          'severity (LOW|MEDIUM|HIGH), confidence (0-1), needsMorePhoto (boolean),',
          'observation (phrase courte en français), suggestedArtisanType (PLUMBER|ELECTRICIAN|LOCKSMITH|HEATING_TECH ou null).',
          'Si HUMIDITY : structuralDegradationVisible, tenantSurfaceNeglectOnly, humidityIndicators[].',
          'Si climatisation / HEATING : darkHaloVisible, condensateOverflowVisible, refrigerantOilResidue, stainUnderIndoorUnit, hvacIndicators[].',
          'Auréole sombre au plafond en saison sèche ≠ infiltration toiture — chercher fuite interne clim/condensats.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ];

    for (const url of input.photoUrls.slice(0, 3)) {
      const inline = await this.loadImageInline(url);
      if (inline) {
        parts.push({
          inline_data: { mime_type: inline.mimeType, data: inline.base64 },
        });
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Réponse Gemini vide');

    const parsed = parseJsonFromLlm<GeminiPathologistJson>(text);
    return this.buildPathologistResult(parsed, input, true);
  }

  private buildPathologistResult(
    parsed: GeminiPathologistJson,
    input: AiPipelineInput,
    fromLlm: boolean,
  ): PathologistResult {
    let category = parsed.category ?? 'OTHER';
    const hasPhoto = input.photoUrls.length > 0;
    const contextText = `${input.title} ${input.description} ${input.tenantFeedback ?? ''}`;
    const sensors = input.diagnosticSensors ?? {};

    if (category === 'OTHER' && isHvacSignalement(contextText)) {
      category = 'HEATING';
    }

    let humidityPhoto: HumidityPhotoAssessment | undefined;
    if (category === 'HUMIDITY' && hasPhoto) {
      if (
        typeof parsed.structuralDegradationVisible === 'boolean' ||
        typeof parsed.tenantSurfaceNeglectOnly === 'boolean'
      ) {
        humidityPhoto = {
          structuralDegradationVisible: Boolean(
            parsed.structuralDegradationVisible,
          ),
          tenantSurfaceNeglectOnly: Boolean(parsed.tenantSurfaceNeglectOnly),
          indicators: Array.isArray(parsed.humidityIndicators)
            ? parsed.humidityIndicators.map(String)
            : [],
        };
      } else {
        humidityPhoto = inferHumidityPhotoFromText(contextText, true);
      }
    }

    let base: PathologistResult = {
      category,
      severity: parsed.severity ?? 'MEDIUM',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      needsMorePhoto: Boolean(parsed.needsMorePhoto),
      observation: parsed.observation ?? 'Analyse visuelle effectuée.',
      suggestedArtisanType: parsed.suggestedArtisanType,
      fromLlm,
      humidityPhoto,
    };

    if (category === 'HEATING' || isHvacSignalement(contextText)) {
      base = this.applyHvacDifferential(base, input, {
        darkHaloVisible: Boolean(parsed.darkHaloVisible),
        condensateOverflowVisible: Boolean(parsed.condensateOverflowVisible),
        refrigerantOilResidue: Boolean(parsed.refrigerantOilResidue),
        stainUnderIndoorUnit: Boolean(parsed.stainUnderIndoorUnit),
      });
    }

    return base;
  }

  private applyHvacDifferential(
    base: PathologistResult,
    input: AiPipelineInput,
    photoCues: HvacPhotoCues,
  ): PathologistResult {
    const contextText = `${input.title} ${input.description} ${input.tenantFeedback ?? ''}`;
    const diff = runHvacDifferential({
      contextText,
      sensors: input.diagnosticSensors ?? {},
      photo: photoCues,
    });

    const hvacPhoto = this.toHvacPhotoAssessment(photoCues, diff);

    return {
      ...base,
      category: 'HEATING',
      observation: diff.observation,
      suggestedArtisanType:
        diff.responsibilityHint === 'BAILLEUR' ? 'HEATING_TECH' : undefined,
      confidence: Math.max(base.confidence, diff.hypotheses[0]?.probability ?? 0.5),
      hvacPhoto,
      differential: {
        leadingHypothesisId: diff.leadingHypothesisId,
        hypotheses: diff.hypotheses.map((h) => ({
          id: h.id,
          label: h.label,
          probability: h.probability,
          eliminated: h.eliminated,
          eliminationReason: h.eliminationReason,
        })),
        roofInfiltrationExcluded: diff.roofInfiltrationExcluded,
      },
    };
  }

  private toHvacPhotoAssessment(
    cues: HvacPhotoCues,
    diff: ReturnType<typeof runHvacDifferential>,
  ): HvacPhotoAssessment {
    const indicators: string[] = [];
    if (cues.darkHaloVisible) indicators.push('auréole sombre');
    if (cues.condensateOverflowVisible) indicators.push('condensats');
    if (cues.refrigerantOilResidue) indicators.push('fuite frigorifique');
    if (cues.stainUnderIndoorUnit) indicators.push('eau sous unité');
    if (diff.roofInfiltrationExcluded) {
      indicators.push('infiltration toiture écartée');
    }
    return {
      darkHaloVisible: Boolean(cues.darkHaloVisible),
      condensateOverflowVisible: Boolean(cues.condensateOverflowVisible),
      refrigerantOilResidue: Boolean(cues.refrigerantOilResidue),
      stainUnderIndoorUnit: Boolean(cues.stainUnderIndoorUnit),
      indicators,
    };
  }

  private analyzeSimulated(input: AiPipelineInput): PathologistResult {
    const categoryText = this.normalizeText(
      `${input.title} ${input.description}`,
    );
    const text = this.normalizeText(
      input.caseContextForRules ??
        `${input.title} ${input.description} ${input.tenantFeedback ?? ''}`,
    );

    const social = ['impay', 'pas payer', 'difficult', 'rsa', 'caf'].some((k) =>
      text.includes(k),
    );
    if (social) {
      return {
        category: 'SOCIAL_SIGNAL',
        severity: 'MEDIUM',
        confidence: 0.88,
        needsMorePhoto: false,
        observation: 'Signal de difficulté sociale détecté dans le texte.',
        fromLlm: false,
      };
    }

    if (isHvacSignalement(categoryText) || isHvacSignalement(text)) {
      const hasPhoto = input.photoUrls.length > 0;
      const photoCues = inferHvacPhotoCuesFromText(
        `${text} ${input.tenantFeedback ?? ''}`,
      );
      const base: PathologistResult = {
        category: 'HEATING',
        severity: 'MEDIUM',
        confidence: hasPhoto ? 0.84 : 0.7,
        needsMorePhoto: !hasPhoto && input.attempt < 2,
        observation: 'Signalement climatisation (simulation).',
        suggestedArtisanType: 'HEATING_TECH',
        fromLlm: false,
      };
      return this.applyHvacDifferential(base, input, photoCues);
    }

    const buckets: Array<{
      category: string;
      keywords: string[];
      artisan?: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }> = [
      {
        category: 'PLUMBING',
        keywords: ['fuite', 'plomberie', 'robinet', 'evier', 'levier', 'wc'],
        artisan: 'PLUMBER',
        severity: 'MEDIUM',
      },
      {
        category: 'ELECTRICITY',
        keywords: [
          'électric',
          'electric',
          'prise',
          'disjonct',
          'ampoule',
          'lumiere',
          'lumière',
          'éclairage',
          'eclairage',
          'interrupteur',
          'plafonnier',
          'courant',
          'panne',
        ],
        artisan: 'ELECTRICIAN',
        severity: 'MEDIUM',
      },
      {
        category: 'HUMIDITY',
        keywords: ['moisissure', 'humidit', 'champignon'],
        severity: 'MEDIUM',
      },
      {
        category: 'LOCK',
        keywords: ['serrure', 'clé perdue', 'cle perdue'],
        artisan: 'LOCKSMITH',
        severity: 'LOW',
      },
    ];

    for (const b of buckets) {
      if (b.keywords.some((k) => categoryText.includes(k))) {
        const hasPhoto = input.photoUrls.length > 0;
        const needsMorePhoto =
          input.attempt === 1 && !hasPhoto && input.description.trim().length < 20;
        const contextText = `${input.title} ${input.description} ${input.tenantFeedback ?? ''}`;
        let observation = `Problème probable : ${b.category.toLowerCase()} (simulation).`;
        let humidityPhoto: HumidityPhotoAssessment | undefined;
        if (b.category === 'HUMIDITY' && hasPhoto) {
          humidityPhoto = inferHumidityPhotoFromText(contextText, true);
          if (humidityPhoto?.structuralDegradationVisible) {
            observation =
              'Photo / texte : signes compatibles avec atteinte du bâti (infiltration ou structure).';
          } else if (humidityPhoto?.tenantSurfaceNeglectOnly) {
            observation =
              'Photo / texte : moisissure de surface localisée, sans dégradation structurelle manifeste.';
          }
        }
        return {
          category: b.category,
          severity: b.severity,
          confidence: hasPhoto ? 0.82 : 0.68,
          needsMorePhoto,
          observation,
          suggestedArtisanType: b.artisan,
          fromLlm: false,
          humidityPhoto,
        };
      }
    }

    return {
      category: 'OTHER',
      severity: 'LOW',
      confidence: 0.35,
      needsMorePhoto: input.photoUrls.length === 0 && input.attempt < 2,
      observation: 'Classification incertaine — précision ou photo recommandée.',
      fromLlm: false,
    };
  }

  private normalizeText(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  private async loadImageInline(
    photoUrl: string,
  ): Promise<{ mimeType: string; base64: string } | null> {
    try {
      const uploadsMatch = /\/uploads\/([^/?#]+)$/i.exec(photoUrl);
      if (uploadsMatch) {
        const filePath = join(process.cwd(), 'uploads', uploadsMatch[1]!);
        const buf = await readFile(filePath);
        const ext = uploadsMatch[1]!.split('.').pop()?.toLowerCase();
        const mimeType =
          ext === 'png'
            ? 'image/png'
            : ext === 'webp'
              ? 'image/webp'
              : 'image/jpeg';
        return { mimeType, base64: buf.toString('base64') };
      }

      const res = await fetch(photoUrl);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
      return { mimeType, base64: buf.toString('base64') };
    } catch (e) {
      this.logger.warn(`Image non chargée: ${photoUrl}`, e);
      return null;
    }
  }
}
