import {
  dispatchGuardrailRefusal,
  dispatchPipelineOutput,
} from './aiCoachEvents';
import { evaluateGuardrail } from './evaluateGuardrail';
import { refusalMessage } from './refusalMessages.i18n';
import type {
  AIPipelineResult,
  PipelineInputOptions,
} from './pipelineTypes';
import type { SupportedLocale } from './useMultilingualAI';

export interface DiagnosticHint {
  category: string;
  severity: 'low' | 'medium' | 'high';
  hint: string;
}

export interface LegalAnalysisInput {
  cleanedText: string;
  diagnostic: DiagnosticHint;
}

export interface PipelineServices {
  sanitize: (t: string) => string;
  diagnose: (t: string) => DiagnosticHint;
  legalInformative: (
    inp: LegalAnalysisInput,
    opts: { hostileTone: boolean },
  ) => string;
  /** Reformulation / fluidité après IA juridique informatique */
  communicate: (body: string, hostileTone: boolean) => string;
  adaptLocale: (
    messageFr: string,
    locale: SupportedLocale,
    wasRefusal: boolean,
  ) => string;
  /** Si true : écrase la sortie événement (tests). */
  silentAvatar?: boolean;
}

function detectHostileTone(t: string): boolean {
  const w = /\b(?:connerie|arnaqu|pourri|gueul|casse toi|foutre|mensonges?)/i.test(
    t,
  );
  return w || /!{4,}|(?:JE\s+SUIS\s+EN\s+RAGE)/i.test(t);
}

/**
 * Chaîne synchrone officielle :
 * 1. Guardrail → 2. Nettoyage → 3. Diagnostic → 4. Juridique informatif → 5. Communication → 6. Multilingue → 7. (événement avatar si demandé).
 */
export function executeAIPipelineSync(
  userText: string,
  services: PipelineServices,
  opts: PipelineInputOptions = {},
): AIPipelineResult {
  const locale: SupportedLocale = opts.locale ?? 'fr';

  const guard = evaluateGuardrail(userText, {
    rgpdStrictMode: opts.rgpdStrictMode,
  });
  if (!guard.allowed) {
    const refusal = refusalMessage(locale);
    if (!services.silentAvatar) {
      dispatchGuardrailRefusal({
        safeMessage: refusal,
        reason: guard.reason,
      });
    }
    return {
      kind: 'refused',
      guard: { ...guard, safeMessage: refusal },
    };
  }

  if (guard.reason === 'EMPTY_INPUT_NAV_ONLY') {
    const msg = services.adaptLocale(
      'Posez votre question dans le champ : je vous aide sur le logement et l’application.',
      locale,
      false,
    );
    if (!services.silentAvatar) {
      dispatchPipelineOutput({ message: msg, expression: 'help' });
    }
    return { kind: 'ok', output: msg, expression: 'help' };
  }

  const cleaned = services.sanitize(userText);
  const diagnostic = services.diagnose(cleaned);
  const hostile = detectHostileTone(cleaned);
  let body = services.legalInformative(
    { cleanedText: cleaned, diagnostic },
    { hostileTone: hostile },
  );
  body = services.communicate(body, hostile);
  const output = services.adaptLocale(body, locale, false);

  if (!services.silentAvatar) {
    dispatchPipelineOutput({
      message: output,
      expression: hostile ? 'help' : 'explain',
    });
  }

  return {
    kind: 'ok',
    output,
    expression: hostile ? 'help' : 'explain',
    diagnostics: { diagnostic, hostileTone: hostile },
  };
}
