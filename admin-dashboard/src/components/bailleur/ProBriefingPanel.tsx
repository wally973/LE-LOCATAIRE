import React, { useCallback, useEffect, useState } from 'react';
import {
  proBriefingApi,
  type ProBriefing,
  type ProBriefingChatEntry,
} from '@services/proBriefingApi';
import { getErrorMessage } from '@services/apiClient';
import '@components/bailleur/bailleur.css';

interface ProBriefingPanelProps {
  ticketId: number;
}

const SUGGESTED_QUESTIONS = [
  'Quels sont les symptômes principaux ?',
  'À la charge de qui est l’intervention ?',
  'Le locataire a-t-il déjà tenté une action ?',
  'Y a-t-il des photos exploitables ?',
];

export const ProBriefingPanel: React.FC<ProBriefingPanelProps> = ({
  ticketId,
}) => {
  const [briefing, setBriefing] = useState<ProBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [chat, setChat] = useState<ProBriefingChatEntry[]>([]);
  const [methodOpen, setMethodOpen] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    proBriefingApi
      .get(ticketId)
      .then(setBriefing)
      .catch((e) => setErr(getErrorMessage(e, 'Briefing indisponible')))
      .finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitQuestion = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setErr('');
    try {
      const res = await proBriefingApi.ask(ticketId, trimmed);
      setChat((prev) => [
        ...prev,
        { question: res.question, answer: res.answer, fromLlm: res.fromLlm },
      ]);
      setQuestion('');
    } catch (e) {
      setErr(getErrorMessage(e, 'Question impossible'));
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return (
      <div className="card pro-briefing" style={{ marginTop: 20 }}>
        <p className="muted">Génération du Pro Briefing…</p>
      </div>
    );
  }

  if (err && !briefing) {
    return (
      <div className="card pro-briefing" style={{ marginTop: 20 }}>
        <div className="alert error">{err}</div>
        <button type="button" className="secondary" onClick={load}>
          Réessayer
        </button>
      </div>
    );
  }

  if (!briefing) return null;

  const { critical, research, savoirVoir } = briefing;

  return (
    <div className="card pro-briefing" style={{ marginTop: 20 }}>
      <div className="pro-briefing__header">
        <h2 style={{ margin: 0 }}>Pro Briefing</h2>
        <span className="pro-briefing__badge">
          {briefing.diagnosticAuthority === 'EXPERT_VALIDATED'
            ? 'Validé expert'
            : briefing.fromLlm
              ? 'Synthèse IA'
              : 'Synthèse règles'}
        </span>
      </div>
      {briefing.expertCorrection ? (
        <div className="pro-briefing__expert-banner">
          <strong>{briefing.expertCorrection.expertName}</strong> —{' '}
          {briefing.expertCorrection.correctedDiagnosis}
          {briefing.expertCorrection.responsibility ? (
            <span className="pro-briefing__expert-meta">
              {' '}
              · Charge : {briefing.expertCorrection.responsibility}
            </span>
          ) : null}
          {briefing.expertCorrection.specialHandling.length > 0 ? (
            <div className="pro-briefing__tags" style={{ marginTop: 8 }}>
              {briefing.expertCorrection.specialHandling.map((h) => (
                <span key={h} className="pro-briefing__chip pro-briefing__chip--warn">
                  {h === 'STRUCTURAL_INFILTRATION'
                    ? 'Structure / infiltration'
                    : h === 'VULNERABLE_TENANT'
                      ? 'Personne vulnérable'
                      : h}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="muted" style={{ marginTop: 8 }}>
        Résumé technique pour préparer l’intervention — interrogez le dossier en
        langage naturel.
      </p>

      {savoirVoir ? (
        <div className="pro-briefing__method">
          <button
            type="button"
            className="pro-briefing__method-toggle"
            onClick={() => setMethodOpen((o) => !o)}
            aria-expanded={methodOpen}
          >
            <strong>{savoirVoir.title}</strong>
            <span className="muted">{methodOpen ? 'Masquer' : 'Afficher'}</span>
          </button>
          {methodOpen ? (
            <div className="pro-briefing__method-body">
              <p className="pro-briefing__method-tagline">{savoirVoir.tagline}</p>
              <ol className="pro-briefing__method-steps">
                {savoirVoir.steps.map((step) => (
                  <li key={step.order}>
                    <strong>
                      {step.order}. {step.name}
                    </strong>
                    <span>{step.what}</span>
                    <em>Votre rôle : {step.technicianRole}</em>
                  </li>
                ))}
              </ol>
              <ul className="pro-briefing__method-commitments">
                {savoirVoir.commitments.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {err ? <div className="alert error">{err}</div> : null}

      <div className="pro-briefing__summary">
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
          {briefing.narrativeSummary}
        </p>
      </div>

      <div className="pro-briefing__grid">
        <div className="pro-briefing__fact">
          <span className="pro-briefing__fact-label">Équipement / zone</span>
          <strong>{critical.model ?? '—'}</strong>
        </div>
        <div className="pro-briefing__fact">
          <span className="pro-briefing__fact-label">Métier</span>
          <strong>{critical.categoryLabel}</strong>
        </div>
        <div className="pro-briefing__fact">
          <span className="pro-briefing__fact-label">Charge</span>
          <strong>{critical.responsibility ?? 'En cours'}</strong>
        </div>
        <div className="pro-briefing__fact">
          <span className="pro-briefing__fact-label">Photos</span>
          <strong>{critical.photoCount}</strong>
        </div>
        {critical.safetyLevel && critical.safetyLevel !== 'green' ? (
          <div className="pro-briefing__fact pro-briefing__fact--warn">
            <span className="pro-briefing__fact-label">Sécurité</span>
            <strong>{critical.safetyLevel}</strong>
          </div>
        ) : null}
      </div>

      {critical.symptoms.length > 0 ? (
        <div className="pro-briefing__section">
          <h3>Symptômes</h3>
          <ul className="pro-briefing__tags">
            {critical.symptoms.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {research.searchTrigger ? (
        <div className="pro-briefing__section">
          <h3>Recherche technique</h3>
          <p>{research.searchTrigger}</p>
        </div>
      ) : null}

      {research.intakeSummary ? (
        <div className="pro-briefing__section">
          <h3>Constats intake</h3>
          <pre className="pro-briefing__pre">{research.intakeSummary}</pre>
        </div>
      ) : null}

      {research.similarCases.length > 0 ? (
        <div className="pro-briefing__section">
          <h3>Affaires similaires</h3>
          <ul>
            {research.similarCases.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {briefing.diagnosticMessage ? (
        <div className="pro-briefing__section">
          <h3>Diagnostic Lia (locataire)</h3>
          <p>{briefing.diagnosticMessage}</p>
        </div>
      ) : null}

      <div className="pro-briefing__qa">
        <h3>Interroger le dossier</h3>
        <div className="pro-briefing__suggestions">
          {SUGGESTED_QUESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="pro-briefing__chip"
              disabled={asking}
              onClick={() => void submitQuestion(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitQuestion(question);
          }}
        >
          <div className="form-group">
            <label htmlFor="pro-q">Votre question</label>
            <textarea
              id="pro-q"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex. : faut-il couper l’eau avant d’intervenir ?"
              disabled={asking}
            />
          </div>
          <button
            type="submit"
            className="primary"
            disabled={asking || !question.trim()}
          >
            {asking ? 'Analyse…' : 'Poser la question'}
          </button>
        </form>

        {chat.length > 0 ? (
          <div className="pro-briefing__chat">
            {chat.map((entry, i) => (
              <div key={`${entry.question}-${i}`} className="pro-briefing__exchange">
                <p className="pro-briefing__q">Q : {entry.question}</p>
                <p className="pro-briefing__a">{entry.answer}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="secondary"
        style={{ marginTop: 16 }}
        onClick={load}
      >
        Actualiser le briefing
      </button>
    </div>
  );
};

export default ProBriefingPanel;
