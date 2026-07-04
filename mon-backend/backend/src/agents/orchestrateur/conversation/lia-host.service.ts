import { Injectable, Logger } from '@nestjs/common';
import {
  GROCK_MISTRAL_FALLBACK_MODEL,
  GROCK_MISTRAL_MODEL,
  GROCK_VISION_MODEL,
} from '../living-intelligence/living-intelligence.config';

/** Réponse hôte Lia (accueil ou reformulation). */
export interface LiaHostReply {
  text: string;
  fromLlm: boolean;
}

/** Dernière panne Groq (diagnostic Lia-Lab / Intercom). */
export type GroqUnavailableReason =
  | 'missing_api_key'
  | 'host_disabled'
  | 'http_error'
  | 'empty_response'
  | 'timeout'
  | 'network';

export interface GroqLastError {
  reason: GroqUnavailableReason;
  httpStatus?: number;
  model?: string;
  detail?: string;
}

/**
 * Agent « Hôte d'accueil » — modèle léger (Groq OpenAI-compatible).
 * Fallback texte fixe si pas de clé API (dev / panne).
 */
@Injectable()
export class LiaHostService {
  private readonly logger = new Logger(LiaHostService.name);
  private lastGroqError: GroqLastError | null = null;

  isGroqConfigured(): boolean {
    return (
      Boolean(process.env.GROQ_API_KEY?.trim()) &&
      process.env.LIA_HOST_ENABLED !== 'false'
    );
  }

  getLastGroqError(): GroqLastError | null {
    return this.lastGroqError;
  }

  /** Ping minimal Groq (Lia-Lab — diagnostic ADMIN). */
  async pingGroq(): Promise<{ ok: boolean; model: string; error?: GroqLastError }> {
    const model = process.env.LIA_HOST_MODEL ?? 'llama-3.1-8b-instant';
    if (!this.isGroqConfigured()) {
      this.lastGroqError = { reason: 'missing_api_key', model };
      return { ok: false, model, error: this.lastGroqError };
    }
    const text = await this.chat('Réponds uniquement : pong', 8, 'Tu es un test.', {
      model,
      timeoutMs: 15_000,
    });
    if (text) return { ok: true, model };
    return { ok: false, model, error: this.lastGroqError ?? { reason: 'network', model } };
  }

  async welcomeAfterTicket(params: {
    tenantFirstName?: string;
    title: string;
  }): Promise<LiaHostReply> {
    const name = params.tenantFirstName?.trim() || 'Bonjour';
    const prompt = [
      `Tu es Lia, assistante du bailleur social en Guyane.`,
      `Le locataire ${name} vient de signaler : "${params.title}".`,
      `Le locataire n'est pas technicien : pas de jargon, pas de diagnostic demandé au locataire.`,
      `Réponds en 2 phrases : accueil chaleureux, vous allez l'aider à décrire le problème puis le bailleur qualifiera les réparations.`,
      `Français simple. Pas de conseil juridique. Pas de diagnostic technique encore.`,
    ].join('\n');

    const llm = await this.chat(prompt, 220);
    if (llm) return { text: llm, fromLlm: true };

    return {
      text:
        `${name}, merci pour votre signalement concernant « ${params.title} ». ` +
        `Décrivez simplement ce que vous voyez — pas besoin d’être technicien, nous qualifierons les réparations. ` +
        `Je m’en occupe tout de suite ; vous pouvez fermer l’application, je vous préviendrai dès que j’ai une réponse.`,
      fromLlm: false,
    };
  }

  async confirmArtisanRequest(params: {
    artisanLabel: string;
    alreadyExists?: boolean;
  }): Promise<LiaHostReply> {
    if (params.alreadyExists) {
      return {
        text:
          `Votre demande de ${params.artisanLabel} est déjà enregistrée. ` +
          `L’équipe vous contactera pour un devis — pas besoin de renvoyer le message.`,
        fromLlm: false,
      };
    }
    return {
      text:
        `Parfait, j’ai transmis votre demande de ${params.artisanLabel} à notre équipe. ` +
        `Un devis vous sera proposé sous peu. Vous serez notifié(e) des prochaines étapes.`,
      fromLlm: false,
    };
  }

  async acknowledgeTenantReply(params: {
    tenantMessage: string;
  }): Promise<LiaHostReply> {
    const prompt = [
      `Tu es Lia. Le locataire vient d'ajouter : "${params.tenantMessage.slice(0, 500)}".`,
      `Réponds en 1-2 phrases : remerciement, tu reprends l'analyse, notification à venir.`,
      `Français. Pas de décision juridique.`,
    ].join('\n');

    const llm = await this.chat(prompt, 120);
    if (llm) return { text: llm, fromLlm: true };

    return {
      text:
        'Merci pour ces précisions. Je reprends l’analyse et je vous écris dès que c’est prêt — vous serez notifié(e).',
      fromLlm: false,
    };
  }

  /** Appel Groq avec prompt système personnalisable (Expert-Compagnon, pont Jarvis, etc.). */
  async chatStructured(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    options?: { json?: boolean; timeoutMs?: number; model?: string },
  ): Promise<string | null> {
    return this.chat(userPrompt, maxTokens, systemPrompt, options);
  }

  /** Fil multi-tours — mémoire immédiate Grock (user/assistant alternés). */
  async chatMultiTurn(
    systemPrompt: string,
    turns: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens: number,
    options?: {
      timeoutMs?: number;
      model?: string;
      fallbackModel?: string;
      json?: boolean;
    },
  ): Promise<{ text: string; model: string } | null> {
    const primary =
      options?.model ??
      process.env.GROQ_MAJORDOME_MODEL ??
      process.env.LIA_HOST_MODEL ??
      'llama-3.1-8b-instant';
    const fallback = options?.fallbackModel?.trim();
    const models = fallback && fallback !== primary ? [primary, fallback] : [primary];

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const text = await this.chatMultiTurnOnce(
          systemPrompt,
          turns,
          maxTokens,
          model,
          options?.timeoutMs ?? 45_000,
          options?.json === true,
        );
        if (text) {
          this.lastGroqError = null;
          return { text, model };
        }
        const err = this.lastGroqError;
        if (err?.httpStatus === 429 && attempt === 0) {
          this.logger.warn(`Groq 429 (${model}) — nouvelle tentative dans 2 s`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        break;
      }
      if (models.length > 1 && model === primary) {
        this.logger.warn(`Groq indisponible sur ${primary} — bascule ${fallback}`);
      }
    }
    return null;
  }

  isMistralConfigured(): boolean {
    return (
      Boolean(process.env.MISTRAL_API_KEY?.trim()) &&
      process.env.LIA_HOST_ENABLED !== 'false'
    );
  }

  /** Ping minimal Mistral (Grock / Lia-Lab). */
  async pingMistral(): Promise<{ ok: boolean; model: string; error?: GroqLastError }> {
    const model = GROCK_MISTRAL_MODEL;
    if (!this.isMistralConfigured()) {
      this.lastGroqError = { reason: 'missing_api_key', model };
      return { ok: false, model, error: this.lastGroqError };
    }
    const result = await this.chatMultiTurnMistral(
      'Tu es un test.',
      [{ role: 'user', content: 'Réponds uniquement : pong' }],
      8,
      { model, timeoutMs: 15_000 },
    );
    if (result?.text) return { ok: true, model: result.model };
    return {
      ok: false,
      model,
      error: this.lastGroqError ?? { reason: 'network', model },
    };
  }

  /** Fil multi-tours Grock via Mistral API. */
  async chatMultiTurnMistral(
    systemPrompt: string,
    turns: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens: number,
    options?: {
      timeoutMs?: number;
      model?: string;
      fallbackModel?: string;
      json?: boolean;
      /** Image(s) attachées au dernier tour locataire → le modèle VOIT la scène. */
      images?: Array<{ mimeType: string; base64: string }>;
    },
  ): Promise<{ text: string; model: string } | null> {
    const primary = options?.model ?? GROCK_MISTRAL_MODEL;
    const fallback = options?.fallbackModel?.trim();
    const models = fallback && fallback !== primary ? [primary, fallback] : [primary];

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const text = await this.chatMultiTurnMistralOnce(
          systemPrompt,
          turns,
          maxTokens,
          model,
          options?.timeoutMs ?? 45_000,
          options?.json === true,
          options?.images,
        );
        if (text) {
          this.lastGroqError = null;
          return { text, model };
        }
        const err = this.lastGroqError;
        if (err?.httpStatus === 429 && attempt === 0) {
          this.logger.warn(`Mistral 429 (${model}) — nouvelle tentative dans 2 s`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        break;
      }
      if (models.length > 1 && model === primary) {
        this.logger.warn(`Mistral indisponible sur ${primary} — bascule ${fallback}`);
      }
    }
    return null;
  }

  private async chatMultiTurnMistralOnce(
    systemPrompt: string,
    turns: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens: number,
    model: string,
    timeoutMs: number,
    json = false,
    images?: Array<{ mimeType: string; base64: string }>,
  ): Promise<string | null> {
    const apiKey = process.env.MISTRAL_API_KEY?.trim();
    if (!apiKey || process.env.LIA_HOST_ENABLED === 'false') {
      this.lastGroqError = {
        reason: !apiKey ? 'missing_api_key' : 'host_disabled',
        model,
        detail: !apiKey ? 'MISTRAL_API_KEY absente dans .env' : 'LIA_HOST_ENABLED=false',
      };
      return null;
    }

    const baseUrl = process.env.MISTRAL_BASE_URL?.trim() ?? 'https://api.mistral.ai/v1';

    // Messages OpenAI-compatibles. Si des images sont fournies, on les attache
    // au dernier tour locataire : le modèle de raisonnement VOIT alors la scène
    // (fin du « jeu du téléphone » où seul un texte de perception circulait).
    const messages: Array<{ role: string; content: unknown }> = [
      { role: 'system', content: systemPrompt },
      ...turns.map((t) => ({ role: t.role, content: t.content as unknown })),
    ];
    if (images?.length) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role !== 'user') continue;
        const previousText =
          typeof messages[i].content === 'string'
            ? (messages[i].content as string)
            : '';
        messages[i] = {
          role: 'user',
          content: [
            { type: 'text', text: previousText },
            ...images.map((img) => ({
              type: 'image_url',
              image_url: `data:${img.mimeType?.trim() || 'image/jpeg'};base64,${img.base64}`,
            })),
          ],
        };
        break;
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature: 0.4,
            response_format: json ? { type: 'json_object' } : undefined,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.lastGroqError = {
          reason: 'http_error',
          httpStatus: res.status,
          model,
          detail: body.slice(0, 280).replace(/\s+/g, ' ').trim(),
        };
        this.logger.warn(`Mistral multi-tour HTTP ${res.status} (${model})`);
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) {
        this.lastGroqError = null;
        return text;
      }
      this.lastGroqError = { reason: 'empty_response', model };
      return null;
    } catch (e) {
      this.lastGroqError = {
        reason: 'network',
        model,
        detail: e instanceof Error ? e.message.slice(0, 200) : 'Erreur réseau',
      };
      this.logger.warn(`Mistral multi-tour indisponible (${model})`, e);
      return null;
    }
  }

  /** Perception visuelle Grock — un message image + contexte texte (Pixtral). */
  async chatVisionMistral(
    systemPrompt: string,
    userText: string,
    imageDataUrl: string,
    maxTokens: number,
    options?: { model?: string; timeoutMs?: number },
  ): Promise<{ text: string; model: string } | null> {
    const model = options?.model ?? GROCK_VISION_MODEL;
    const text = await this.chatVisionMistralOnce(
      systemPrompt,
      userText,
      imageDataUrl,
      maxTokens,
      model,
      options?.timeoutMs ?? 90_000,
    );
    if (text) {
      this.lastGroqError = null;
      return { text, model };
    }
    return null;
  }

  private async chatVisionMistralOnce(
    systemPrompt: string,
    userText: string,
    imageDataUrl: string,
    maxTokens: number,
    model: string,
    timeoutMs: number,
  ): Promise<string | null> {
    const apiKey = process.env.MISTRAL_API_KEY?.trim();
    if (!apiKey || process.env.LIA_HOST_ENABLED === 'false') {
      this.lastGroqError = {
        reason: !apiKey ? 'missing_api_key' : 'host_disabled',
        model,
        detail: !apiKey ? 'MISTRAL_API_KEY absente dans .env' : 'LIA_HOST_ENABLED=false',
      };
      return null;
    }

    const baseUrl = process.env.MISTRAL_BASE_URL?.trim() ?? 'https://api.mistral.ai/v1';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: userText },
                  { type: 'image_url', image_url: imageDataUrl },
                ],
              },
            ],
            max_tokens: maxTokens,
            temperature: 0.2,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.lastGroqError = {
          reason: 'http_error',
          httpStatus: res.status,
          model,
          detail: body.slice(0, 280).replace(/\s+/g, ' ').trim(),
        };
        this.logger.warn(`Mistral vision HTTP ${res.status} (${model})`);
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
      this.lastGroqError = { reason: 'empty_response', model };
      return null;
    } catch (e) {
      this.lastGroqError = {
        reason: 'network',
        model,
        detail: e instanceof Error ? e.message.slice(0, 200) : 'Erreur réseau',
      };
      this.logger.warn(`Mistral vision indisponible (${model})`, e);
      return null;
    }
  }

  private async chatMultiTurnOnce(
    systemPrompt: string,
    turns: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens: number,
    model: string,
    timeoutMs: number,
    json = false,
  ): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey || process.env.LIA_HOST_ENABLED === 'false') {
      this.lastGroqError = {
        reason: !apiKey ? 'missing_api_key' : 'host_disabled',
        model,
      };
      return null;
    }

    const baseUrl =
      process.env.LIA_HOST_BASE_URL ?? 'https://api.groq.com/openai/v1';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...turns.map((t) => ({ role: t.role, content: t.content })),
            ],
            max_tokens: maxTokens,
            temperature: 0.35,
            response_format: json ? { type: 'json_object' } : undefined,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.lastGroqError = {
          reason: 'http_error',
          httpStatus: res.status,
          model,
          detail: body.slice(0, 280).replace(/\s+/g, ' ').trim(),
        };
        this.logger.warn(`Groq multi-tour HTTP ${res.status} (${model})`);
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) {
        this.lastGroqError = null;
        return text;
      }
      this.lastGroqError = { reason: 'empty_response', model };
      return null;
    } catch (e) {
      this.lastGroqError = {
        reason: 'network',
        model,
        detail: e instanceof Error ? e.message.slice(0, 200) : 'Erreur réseau',
      };
      this.logger.warn(`Groq multi-tour indisponible (${model})`, e);
      return null;
    }
  }

  private async chat(
    userPrompt: string,
    maxTokens: number,
    systemPrompt = 'Tu es Lia, assistante logement en Guyane française. Ton court, humain, rassurant.',
    options?: { json?: boolean; timeoutMs?: number; model?: string },
  ): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    const model =
      options?.model ??
      process.env.LIA_HOST_MODEL ??
      'llama-3.1-8b-instant';
    if (!apiKey || process.env.LIA_HOST_ENABLED === 'false') {
      this.lastGroqError = {
        reason: !apiKey ? 'missing_api_key' : 'host_disabled',
        model,
        detail: !apiKey
          ? 'GROQ_API_KEY absente dans mon-backend/backend/.env'
          : 'LIA_HOST_ENABLED=false',
      };
      return null;
    }

    const baseUrl =
      process.env.LIA_HOST_BASE_URL ?? 'https://api.groq.com/openai/v1';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        options?.timeoutMs ?? 12_000,
      );
      const useJson =
        options?.json === true || /JSON uniquement/i.test(systemPrompt);
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: maxTokens,
            temperature: 0.25,
            response_format: useJson ? { type: 'json_object' } : undefined,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const detail = body.slice(0, 280).replace(/\s+/g, ' ').trim();
        this.lastGroqError = {
          reason: 'http_error',
          httpStatus: res.status,
          model,
          detail: detail || `HTTP ${res.status}`,
        };
        this.logger.warn(
          `Groq hôte HTTP ${res.status} (${model}) — ${this.lastGroqError.detail}`,
        );
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 0) {
        this.lastGroqError = null;
        return text;
      }
      this.lastGroqError = {
        reason: 'empty_response',
        model,
        detail: 'Réponse Groq vide',
      };
      return null;
    } catch (e) {
      const aborted =
        e instanceof Error &&
        (e.name === 'AbortError' || /aborted|timeout/i.test(e.message));
      this.lastGroqError = {
        reason: aborted ? 'timeout' : 'network',
        model,
        detail: e instanceof Error ? e.message.slice(0, 200) : 'Erreur réseau',
      };
      this.logger.warn(`Groq hôte indisponible (${model})`, e);
      return null;
    }
  }
}
