import type { RecordAiDiagnosticPayload } from '@services/aiDiagnosticsApi';
import type { AIPipelineResult } from './pipelineTypes';
import type { SupportedLocale } from './useMultilingualAI';

export function buildAiDiagnosticPayload(
  result: AIPipelineResult,
  opts: { locale: SupportedLocale; cleanedText: string },
): RecordAiDiagnosticPayload {
  const locale = opts.locale ?? 'fr';

  if (result.kind === 'refused') {
    return {
      locale,
      category: 'GUARDRAIL',
      severity: 'low',
      target: 'NONE',
      refused: true,
      refusalReason: result.guard.reason ?? 'blocked',
      diagnosticSummary: `[refus pipeline] motif=${result.guard.reason ?? 'guardrail'}; aucune saisie utilisateur stockée.`,
      pipelineSteps: {
        guardrail: result.guard.reason ?? 'blocked',
      },
      bailleurFlag: false,
      adminFlag: false,
    };
  }

  const rawDiag = result.diagnostics?.diagnostic;
  const diag =
    rawDiag &&
    typeof rawDiag === 'object' &&
    rawDiag !== null &&
    'category' in rawDiag &&
    'severity' in rawDiag
      ? (rawDiag as {
          category: string;
          severity: 'low' | 'medium' | 'high';
          hint: string;
        })
      : null;

  const category = diag?.category ?? 'UNKNOWN';
  const severity = diag?.severity ?? 'low';

  const bailleurFlag =
    /\bbailleur\b/i.test(opts.cleanedText) ||
    /\bpropri[eé]taire\b/i.test(opts.cleanedText);
  const adminFlag =
    /\b(?:admin|syndic|gestion(?:naire)?)/i.test(opts.cleanedText) &&
    /\b(?:immeuble|copropri|charges?\s+communes)/i.test(opts.cleanedText);

  const artisanType =
    category === 'PLUMBING'
      ? 'PLUMBING'
      : category === 'ELECTRICITY'
        ? 'ELECTRICITY'
        : category === 'HUMIDITY'
          ? 'HUMIDITY'
          : category === 'LOCKSMITH'
            ? 'LOCKSMITH'
            : null;

  let target: 'ADMIN' | 'LANDLORD' | 'ARTISAN' | 'NONE' = 'NONE';
  if (artisanType) target = 'ARTISAN';
  else if (bailleurFlag) target = 'LANDLORD';
  else if (adminFlag) target = 'ADMIN';

  const diagHint = diag?.hint?.slice(0, 280) ?? '';
  const diagnosticSummary = [
    `Catégorie automatique ${category}, gravité ${severity}.`,
    diagHint ? `Indicateur métier : ${diagHint}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    locale,
    category,
    severity,
    target,
    refused: false,
    diagnosticSummary,
    pipelineSteps: {
      guardrail: 'IN_SCOPE',
      diagnostic: diag,
      expression: result.expression,
    },
    avatarVariant: result.expression,
    artisanType,
    bailleurFlag,
    adminFlag,
  };
}
