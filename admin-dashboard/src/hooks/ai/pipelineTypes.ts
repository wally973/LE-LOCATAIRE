import type { AvatarExpression } from '@/types/locataire';
import type { SupportedLocale } from './useMultilingualAI';

/** Résultat de `evaluateGuardrail` (bride périmètre logement / application). */
export interface AIGuardrailResult {
  allowed: boolean;
  safeMessage?: string;
  reason?: string;
}

export type PipelineSuccessResult = {
  kind: 'ok';
  /** Texte final (après communication + locale) */
  output: string;
  expression: AvatarExpression;
  diagnostics?: Record<string, unknown>;
};

export type PipelineRefusalResult = {
  kind: 'refused';
  guard: AIGuardrailResult;
};

export type AIPipelineResult = PipelineSuccessResult | PipelineRefusalResult;

export interface PipelineInputOptions {
  locale?: SupportedLocale;
  /** Détection PII ; si absent, valeur lue depuis les préférences locataire (par défaut stricte). */
  rgpdStrictMode?: boolean;
  /** Ne pas émettre les événements avatar (tests). */
  silentAvatar?: boolean;
  /** Ne pas envoyer POST /ai-diagnostics/record. */
  skipAiDiagnosticRecord?: boolean;
}
