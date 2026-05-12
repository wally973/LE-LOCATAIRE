import { useCallback, useMemo } from 'react';
import type { AvatarExpression } from '@/types/locataire';
import { recordAiDiagnostic } from '@services/aiDiagnosticsApi';
import { buildAiDiagnosticPayload } from './buildDiagnosticRecordPayload';
import { dispatchPipelineOutput } from './aiCoachEvents';
import { minimalCleanText } from './evaluateGuardrail';
import { executeAIPipelineSync } from './executeAIPipeline';
import type { AIPipelineResult, PipelineInputOptions } from './pipelineTypes';
import { getRgpdStrictAiMode } from './useRgpdStrictAiPrefs';
import type { SupportedLocale } from './useMultilingualAI';
import { useCleaningAI } from './useCleaningAI';
import { useCommunicationAI } from './useCommunicationAI';
import { useDiagnosticAI } from './useDiagnosticAI';
import { useLegalAI } from './useLegalAI';
import { useMultilingualAI } from './useMultilingualAI';

export interface CoachStep {
  message: string;
  expression: AvatarExpression;
  highlightSelector?: string;
}

/**
 * Orchestrateur IA — coordonne la bride, le nettoyage, le diagnostic,
 * l’analyse juridique informative, la communication, le multilingue et l’avatar (événements).
 */
export function useOrchestratorAI() {
  const cleaning = useCleaningAI();
  const diagnostic = useDiagnosticAI();
  const legal = useLegalAI();
  const comm = useCommunicationAI();
  const multilingual = useMultilingualAI();

  const runPipeline = useCallback(
    (userText: string, opts?: PipelineInputOptions): AIPipelineResult => {
      const locale: SupportedLocale = opts?.locale ?? 'fr';
      const rgpdStrictMode = opts?.rgpdStrictMode ?? getRgpdStrictAiMode();

      try {
        const result = executeAIPipelineSync(
          userText,
          {
            sanitize: cleaning.sanitizeUserInput,
            diagnose: diagnostic.suggest,
            legalInformative: legal.buildInformativeRentalBrief,
            communicate: (body, hostile) =>
              comm.polish(comm.softenHostileOpeners(body, hostile)),
            adaptLocale: multilingual.adaptUserFacingText,
            silentAvatar: opts?.silentAvatar,
          },
          { ...opts, locale, rgpdStrictMode },
        );

        const cleanedForMeta = minimalCleanText(
          cleaning.sanitizeUserInput(userText),
        );

        if (
          !opts?.skipAiDiagnosticRecord &&
          typeof window !== 'undefined' &&
          window.localStorage.getItem('access_token')
        ) {
          const payload = buildAiDiagnosticPayload(result, {
            locale,
            cleanedText: cleanedForMeta,
          });
          void recordAiDiagnostic(payload).catch(() => {});
        }

        return result;
      } catch {
        const msg = multilingual.adaptUserFacingText(
          'Une erreur est survenue. Reformulez votre question en lien avec votre logement.',
          locale,
          false,
        );
        dispatchPipelineOutput({
          message: msg,
          expression: 'alert',
        });
        const errResult: AIPipelineResult = {
          kind: 'ok',
          output: msg,
          expression: 'alert',
        };
        if (
          !opts?.skipAiDiagnosticRecord &&
          typeof window !== 'undefined' &&
          window.localStorage.getItem('access_token')
        ) {
          const payload = buildAiDiagnosticPayload(errResult, {
            locale,
            cleanedText: '',
          });
          payload.category = 'PIPELINE_ERROR';
          payload.diagnosticSummary = 'Erreur pipeline côté client.';
          void recordAiDiagnostic(payload).catch(() => {});
        }
        return errResult;
      }
    },
    [
      cleaning.sanitizeUserInput,
      diagnostic.suggest,
      legal.buildInformativeRentalBrief,
      comm.polish,
      comm.softenHostileOpeners,
      multilingual,
    ],
  );

  const suggestForRoute = useCallback(
    (pathname: string): CoachStep | null => {
      if (pathname.includes('/locataire/tickets')) {
        return {
          message:
            'Créez un ticket pour signaler un problème dans votre logement.',
          expression: 'help',
          highlightSelector: '[data-coach="new-ticket"]',
        };
      }
      if (pathname.includes('/locataire/paiements')) {
        return {
          message: 'Consultez vos quittances et l’historique des paiements.',
          expression: 'explain',
          highlightSelector: '[data-coach="payments-table"]',
        };
      }
      if (pathname.includes('/locataire/parametres')) {
        return {
          message:
            'Activez ou masquez l’avatar assistant selon votre préférence.',
          expression: 'confirm',
        };
      }
      if (pathname === '/locataire/dashboard' || pathname === '/locataire') {
        return {
          message:
            'Bienvenue ! Parcourez le menu pour gérer paiements et tickets.',
          expression: 'neutral',
        };
      }
      return null;
    },
    [],
  );

  return useMemo(
    () => ({
      runPipeline,
      suggestForRoute,
    }),
    [runPipeline, suggestForRoute],
  );
}
