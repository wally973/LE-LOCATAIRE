import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  AI_GUARD_RAIL_REFUSAL_EVENT,
  AI_PIPELINE_OUTPUT_EVENT,
  type AIGuardrailRefusalPayload,
  type AIPipelineOutputPayload,
} from '@hooks/ai/aiCoachEvents';
import { useCommunicationAI } from '@hooks/ai/useCommunicationAI';
import { useOrchestratorAI } from '@hooks/ai/useOrchestratorAI';
import type {
  AIPipelineResult,
  PipelineInputOptions,
} from '@hooks/ai/pipelineTypes';
import type { SupportedLocale } from '@hooks/ai/useMultilingualAI';
import {
  getAvatarOverlayEnabled,
  setAvatarOverlayEnabled,
} from '@hooks/useLocataireAvatarSettings';
import type { AvatarExpression } from '@/types/locataire';

type TransientCoach = {
  message: string;
  expression: AvatarExpression;
  kind: 'refusal' | 'pipeline';
};

interface AvatarCoachState {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  message: string;
  expression: AvatarExpression;
  coachVariant: 'default' | 'refusal';
  highlightSelector: string | null;
  pointer: { x: number; y: number };
  setPointer: (p: { x: number; y: number }) => void;
  /** Pipeline complet : bride → … → événements avatar */
  runAssistantPipeline: (
    text: string,
    opts?: Pick<
      PipelineInputOptions,
      'locale' | 'silentAvatar' | 'skipAiDiagnosticRecord' | 'rgpdStrictMode'
    >,
  ) => AIPipelineResult;
}

const AvatarCoachContext = createContext<AvatarCoachState | null>(null);

const PIPELINE_HINT_MS = 22_000;

export const AvatarCoachProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { pathname } = useLocation();
  const { polish } = useCommunicationAI();
  const { suggestForRoute, runPipeline } = useOrchestratorAI();

  const routeStep = useMemo(
    () => suggestForRoute(pathname),
    [pathname, suggestForRoute],
  );

  const [enabled, setEnabledState] = useState(getAvatarOverlayEnabled);
  const [transient, setTransient] = useState<TransientCoach | null>(null);

  const [baseMessage, setBaseMessage] = useState('');
  const [baseExpression, setBaseExpression] =
    useState<AvatarExpression>('neutral');
  const [highlightSelector, setHighlightSelector] = useState<string | null>(
    null,
  );
  const [pointer, setPointer] = useState({ x: 80, y: 72 });
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const coachVariant: 'default' | 'refusal' =
    transient?.kind === 'refusal' ? 'refusal' : 'default';

  const scheduleClearTransient = useCallback(() => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(
      () => setTransient(null),
      PIPELINE_HINT_MS,
    );
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setAvatarOverlayEnabled(v);
    setEnabledState(v);
  }, []);

  useEffect(() => {
    const on = () => setEnabledState(getAvatarOverlayEnabled());
    window.addEventListener('locataire-avatar-settings-changed', on);
    return () => window.removeEventListener('locataire-avatar-settings-changed', on);
  }, []);

  useEffect(() => {
    const onRefusal = (ev: Event) => {
      const e = ev as CustomEvent<AIGuardrailRefusalPayload>;
      const msg = e.detail?.safeMessage ?? '';
      setTransient({ message: msg, expression: 'alert', kind: 'refusal' });
      scheduleClearTransient();
    };
    const onPipeline = (ev: Event) => {
      const e = ev as CustomEvent<AIPipelineOutputPayload>;
      if (!e.detail) return;
      setTransient({
        message: e.detail.message,
        expression: e.detail.expression,
        kind: 'pipeline',
      });
      scheduleClearTransient();
    };
    window.addEventListener(AI_GUARD_RAIL_REFUSAL_EVENT, onRefusal);
    window.addEventListener(AI_PIPELINE_OUTPUT_EVENT, onPipeline);
    return () => {
      window.removeEventListener(AI_GUARD_RAIL_REFUSAL_EVENT, onRefusal);
      window.removeEventListener(AI_PIPELINE_OUTPUT_EVENT, onPipeline);
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, [scheduleClearTransient]);

  useEffect(() => {
    if (!routeStep) {
      setBaseMessage('');
      setHighlightSelector(null);
      setBaseExpression('neutral');
      return;
    }
    setBaseMessage(polish(routeStep.message) || routeStep.message);
    setBaseExpression(routeStep.expression);
    setHighlightSelector(routeStep.highlightSelector ?? null);
  }, [routeStep, polish]);

  const message = transient?.message ?? baseMessage;
  const expression = transient?.expression ?? baseExpression;

  useEffect(() => {
    if (!enabled) return;
    if (transient) {
      setPointer({
        x: Math.max(16, window.innerWidth * 0.5 - 56),
        y: Math.max(16, window.innerHeight - 220),
      });
      return;
    }
    if (!highlightSelector) {
      setPointer({
        x: Math.max(16, window.innerWidth - 120),
        y: Math.max(16, window.innerHeight - 200),
      });
      return;
    }
    const el = document.querySelector(highlightSelector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPointer({
      x: Math.max(16, r.left + r.width / 2 - 40),
      y: Math.max(16, r.top - 8),
    });
  }, [highlightSelector, pathname, enabled, message, transient]);

  const runAssistantPipeline = useCallback(
    (
      text: string,
      opts?: Pick<
        PipelineInputOptions,
        'locale' | 'silentAvatar' | 'skipAiDiagnosticRecord' | 'rgpdStrictMode'
      >,
    ) => {
      return runPipeline(text, {
        locale: opts?.locale ?? 'fr',
        silentAvatar: opts?.silentAvatar,
        skipAiDiagnosticRecord: opts?.skipAiDiagnosticRecord,
        rgpdStrictMode: opts?.rgpdStrictMode,
      });
    },
    [runPipeline],
  );

  const value = useMemo(
    () => ({
      enabled,
      setEnabled,
      message,
      expression,
      coachVariant,
      highlightSelector,
      pointer,
      setPointer,
      runAssistantPipeline,
    }),
    [
      enabled,
      setEnabled,
      message,
      expression,
      coachVariant,
      highlightSelector,
      pointer,
      runAssistantPipeline,
    ],
  );

  return (
    <AvatarCoachContext.Provider value={value}>
      {children}
    </AvatarCoachContext.Provider>
  );
};

export function useAvatarCoach() {
  const ctx = useContext(AvatarCoachContext);
  if (!ctx) {
    throw new Error('useAvatarCoach must be used within AvatarCoachProvider');
  }
  return ctx;
}
