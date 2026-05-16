import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { AiPipelineInput } from '../ai-pipeline.port';
import { parseJsonFromLlm } from '../utils/llm-json.util';
import type { PathologistResult } from './pathologist.types';

interface GeminiPathologistJson {
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  needsMorePhoto: boolean;
  observation: string;
  suggestedArtisanType?: string;
}

/**
 * Agent pathologiste — analyse photo + description (Gemini Vision).
 * Sans clé API : simulation déterministe pour les tests locaux.
 */
@Injectable()
export class LiaPathologistService {
  private readonly logger = new Logger(LiaPathologistService.name);

  async analyze(input: AiPipelineInput): Promise<PathologistResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && process.env.LIA_PATHOLOGIST_ENABLED !== 'false') {
      try {
        return await this.analyzeWithGemini(input, apiKey);
      } catch (e) {
        this.logger.warn('Gemini pathologiste indisponible, fallback simulation', e);
      }
    }
    return this.analyzeSimulated(input);
  }

  private async analyzeWithGemini(
    input: AiPipelineInput,
    apiKey: string,
  ): Promise<PathologistResult> {
    const model =
      process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    const parts: Array<Record<string, unknown>> = [
      {
        text: [
          'Tu es un pathologiste du bâtiment pour un bailleur social en Guyane.',
          'Analyse la description et les photos (si présentes).',
          `Titre: ${input.title}`,
          `Description: ${input.description}`,
          input.tenantFeedback ? `Précision locataire: ${input.tenantFeedback}` : '',
          `Tentative n°${input.attempt}.`,
          'Réponds UNIQUEMENT en JSON valide avec les clés:',
          'category (PLUMBING|ELECTRICITY|HUMIDITY|LOCK|HEATING|WATER_DAMAGE|SOCIAL_SIGNAL|OTHER),',
          'severity (LOW|MEDIUM|HIGH), confidence (0-1), needsMorePhoto (boolean),',
          'observation (phrase courte en français), suggestedArtisanType (PLUMBER|ELECTRICIAN|LOCKSMITH|HEATING_TECH ou null).',
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
    return {
      category: parsed.category ?? 'OTHER',
      severity: parsed.severity ?? 'MEDIUM',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      needsMorePhoto: Boolean(parsed.needsMorePhoto),
      observation: parsed.observation ?? 'Analyse visuelle effectuée.',
      suggestedArtisanType: parsed.suggestedArtisanType,
      fromLlm: true,
    };
  }

  /** Simulation locale (mots-clés) — même logique métier que le stub historique. */
  private analyzeSimulated(input: AiPipelineInput): PathologistResult {
    const text = this.normalizeText(
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
        keywords: ['électric', 'electric', 'prise', 'disjonct'],
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
      if (b.keywords.some((k) => text.includes(k))) {
        const hasPhoto = input.photoUrls.length > 0;
        const needsMorePhoto =
          input.attempt === 1 && !hasPhoto && input.description.trim().length < 20;
        return {
          category: b.category,
          severity: b.severity,
          confidence: hasPhoto ? 0.82 : 0.68,
          needsMorePhoto,
          observation: `Problème probable : ${b.category.toLowerCase()} (simulation).`,
          suggestedArtisanType: b.artisan,
          fromLlm: false,
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
