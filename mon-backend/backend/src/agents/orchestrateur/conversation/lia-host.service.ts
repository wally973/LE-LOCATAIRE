import { Injectable, Logger } from '@nestjs/common';

/** Réponse hôte Lia (accueil ou reformulation). */
export interface LiaHostReply {
  text: string;
  fromLlm: boolean;
}

/**
 * Agent « Hôte d'accueil » — modèle léger (Groq OpenAI-compatible).
 * Fallback texte fixe si pas de clé API (dev / panne).
 */
@Injectable()
export class LiaHostService {
  private readonly logger = new Logger(LiaHostService.name);

  async welcomeAfterTicket(params: {
    tenantFirstName?: string;
    title: string;
  }): Promise<LiaHostReply> {
    const name = params.tenantFirstName?.trim() || 'Bonjour';
    const prompt = [
      `Tu es Lia, assistante du bailleur social en Guyane (2terHabitat).`,
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
    options?: { json?: boolean; timeoutMs?: number },
  ): Promise<string | null> {
    return this.chat(userPrompt, maxTokens, systemPrompt, options);
  }

  private async chat(
    userPrompt: string,
    maxTokens: number,
    systemPrompt = 'Tu es Lia, assistante logement en Guyane française. Ton court, humain, rassurant.',
    options?: { json?: boolean; timeoutMs?: number },
  ): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || process.env.LIA_HOST_ENABLED === 'false') {
      return null;
    }

    const model =
      process.env.LIA_HOST_MODEL ?? 'llama-3.1-8b-instant';
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
        this.logger.warn(`Groq hôte HTTP ${res.status}`);
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text && text.length > 0 ? text : null;
    } catch (e) {
      this.logger.warn('Groq hôte indisponible', e);
      return null;
    }
  }
}
