import { Injectable, Logger } from '@nestjs/common';
import { LiaHostService } from '../orchestrateur/conversation/lia-host.service';
import {
  analyzingStatus,
  landlordHandoffStatus,
  type LiaMessageUiStatus,
} from '../orchestrateur/conversation/lia-message-ui-status';
import {
  LiaIntakeService,
  type LiaIntakeState,
} from '../orchestrateur/intake/lia-intake.service';
import type {
  LlmFirstComprehensionResult,
  LlmFirstModelOutput,
} from './lia-llm-first.types';

const LLM_FIRST_SYSTEM = [
  'Tu es Lia, technicienne logement en Guyane — « Expert de poche ».',
  'MODE LLM-FIRST : tu comprends le locataire comme un humain bienveillant.',
  'Les règles techniques, arbres de panne et bases légales servent UNIQUEMENT plus tard pour VALIDER le diagnostic — ne les cite pas au locataire.',
  '',
  'Règles strictes :',
  '1) Ne redemande JAMAIS une information déjà dans le signalement ou les messages précédents.',
  '2) Reformule ce que tu as compris (quoi, où, depuis quand si dit, urgence).',
  '3) Au plus UNE question si une info CRITIQUE manque vraiment (sécurité, eau qui coule, porte bloquée, risque électrique).',
  '4) Si le message est clair (~80 %), intakeComplete=true sans demander de photo.',
  '5) Contestation ou colère : excuse courte + recentrage sur le dossier initial, pas de changement de sujet.',
  '6) Créole guadeloupéen (gcf) UNIQUEMENT si le locataire écrit clairement en créole ; sinon français simple.',
  '7) Pas de jargon, pas de questionnaire type formulaire.',
  '',
  'Réponds en JSON uniquement :',
  '{',
  '  "language": "fr" | "gcf",',
  '  "acknowledgment": "2 à 4 phrases pour le locataire",',
  '  "nextQuestion": null ou "une seule question utile",',
  '  "intakeComplete": boolean,',
  '  "acquiredFacts": { "cle": "valeur factuelle" },',
  '  "skipScriptQuestions": true,',
  '  "uiStatusKind": "ANALYZING" | "LANDLORD_HANDOFF" | null',
  '}',
].join('\n');

@Injectable()
export class LiaLlmFirstComprehensionService {
  private readonly logger = new Logger(LiaLlmFirstComprehensionService.name);

  constructor(
    private readonly host: LiaHostService,
    private readonly intake: LiaIntakeService,
  ) {}

  isLlmFirstMode(state: LiaIntakeState): boolean {
    return (state.intakeMode ?? 'llm_first') === 'llm_first';
  }

  /** Première parole Lia après lecture du signalement (sans message locataire). */
  async comprehendOpening(params: {
    state: LiaIntakeState;
    title: string;
    description: string;
    tenantFirstName?: string;
  }): Promise<LlmFirstComprehensionResult> {
    const name = params.tenantFirstName?.trim() || 'Bonjour';
    const user = JSON.stringify({
      mode: 'opening',
      tenantFirstName: name,
      signalement: {
        title: params.title,
        description: params.description,
      },
      dejaAcquis: {
        answers: params.state.answers,
        jarvisFacts: params.state.jarvisFacts ?? {},
      },
      consigne:
        'Accueil + reformulation de ce que vous avez compris. intakeComplete si le signalement suffit.',
    });

    const parsed = await this.callModel(user);
    if (!parsed) {
      return this.fallbackOpening(params);
    }
    return this.applyModelOutput(params.state, parsed, params.title, params.description);
  }

  /** Réponse à un message locataire en cours de fil. */
  async comprehendTenantTurn(params: {
    state: LiaIntakeState;
    message: string;
    title: string;
    description: string;
    tenantFirstName?: string;
  }): Promise<LlmFirstComprehensionResult> {
    const name = params.tenantFirstName?.trim() || 'Bonjour';
    const user = JSON.stringify({
      mode: 'tenant_turn',
      tenantFirstName: name,
      signalement: {
        title: params.title,
        description: params.description,
      },
      messageLocataire: params.message.slice(0, 800),
      dejaAcquis: {
        answers: params.state.answers,
        jarvisFacts: params.state.jarvisFacts ?? {},
      },
    });

    const parsed = await this.callModel(user);
    if (!parsed) {
      return this.fallbackTurn(params);
    }
    return this.applyModelOutput(
      params.state,
      parsed,
      params.title,
      params.description,
      params.message,
    );
  }

  private async callModel(userPrompt: string): Promise<LlmFirstModelOutput | null> {
    const raw = await this.host.chatStructured(LLM_FIRST_SYSTEM, userPrompt, 520);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as LlmFirstModelOutput;
      const ack = parsed.acknowledgment?.trim();
      if (!ack) return null;
      return {
        ...parsed,
        acknowledgment: ack,
        nextQuestion:
          parsed.nextQuestion === null || parsed.nextQuestion === undefined
            ? null
            : String(parsed.nextQuestion).trim() || null,
      };
    } catch (e) {
      this.logger.warn('LLM-first JSON invalide', e);
      return null;
    }
  }

  private applyModelOutput(
    state: LiaIntakeState,
    model: LlmFirstModelOutput,
    title: string,
    description: string,
    lastMessage?: string,
  ): LlmFirstComprehensionResult {
    const lang = model.language === 'gcf' ? 'gcf' : 'fr';
    const facts = model.acquiredFacts ?? {};
    const answers: Record<string, string> = {
      ...state.answers,
      llm_last_summary: model.acknowledgment.slice(0, 500),
    };
    for (const [k, v] of Object.entries(facts)) {
      answers[`fact_${k}`] = v;
    }
    if (lastMessage?.trim()) {
      answers.llm_last_tenant_message = lastMessage.trim();
    }

    let next: LiaIntakeState = {
      ...state,
      intakeMode: 'llm_first',
      preferredLanguage: lang,
      answers,
      jarvisFacts: { ...(state.jarvisFacts ?? {}), ...facts },
      skippedQuestionIds: [
        ...new Set([
          ...(state.skippedQuestionIds ?? []),
          ...(model.skipScriptQuestions !== false
            ? this.intake.allScriptQuestionIds(state.category)
            : []),
        ]),
      ],
    };

    if (model.intakeComplete) {
      next = {
        ...next,
        phase: 'DONE',
        stepIndex: 0,
        answers: { ...next.answers, llm_intake_complete: 'oui' },
      };
    } else if (next.phase !== 'AWAITING_PHOTO') {
      next = { ...next, phase: 'INTAKE' };
    }

    const uiStatus = this.resolveUiStatus(model, lang);

    return {
      state: next,
      acknowledgment: model.acknowledgment,
      nextQuestion: model.nextQuestion ?? null,
      uiStatus,
      fromLlm: true,
    };
  }

  private resolveUiStatus(
    model: LlmFirstModelOutput,
    lang: 'fr' | 'gcf',
  ): LiaMessageUiStatus | undefined {
    if (model.uiStatusKind === 'LANDLORD_HANDOFF') {
      return landlordHandoffStatus(lang);
    }
    if (model.uiStatusKind === 'ANALYZING' || model.intakeComplete) {
      return analyzingStatus(lang);
    }
    return undefined;
  }

  private fallbackOpening(params: {
    state: LiaIntakeState;
    title: string;
    description: string;
    tenantFirstName?: string;
  }): LlmFirstComprehensionResult {
    const name = params.tenantFirstName?.trim() || 'Bonjour';
    const text =
      `${name}, merci pour votre signalement. J’ai lu votre description et je la garde en tête — ` +
      'je ne vous ferai pas répéter. Dites-moi seulement si quelque chose de critique manque (accès, sécurité, eau qui coule).';
    return {
      state: {
        ...params.state,
        intakeMode: 'llm_first',
        skippedQuestionIds: this.intake.allScriptQuestionIds(params.state.category),
      },
      acknowledgment: text,
      nextQuestion: null,
      fromLlm: false,
    };
  }

  private fallbackTurn(params: {
    state: LiaIntakeState;
    message: string;
    title: string;
    description: string;
    tenantFirstName?: string;
  }): LlmFirstComprehensionResult {
    const name = params.tenantFirstName?.trim() || 'Bonjour';
    const text =
      `${name}, c’est bien noté. Je m’appuie sur tout ce que vous avez déjà écrit pour avancer.`;
    return {
      state: params.state,
      acknowledgment: text,
      nextQuestion: null,
      fromLlm: false,
    };
  }
}
