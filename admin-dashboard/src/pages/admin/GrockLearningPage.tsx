import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchGrockCandidates,
  fetchGrockLessons,
  getGrockLearningErrorMessage,
  proposeGrockLesson,
  rejectGrockLesson,
  signGrockLesson,
  GROCK_DOMAINS,
  GROCK_PROBE_LABELS,
  type GrockDomain,
  type GrockLesson,
  type GrockLessonCandidate,
} from '@services/grockLearningApi';
import './GrockLearningPage.css';

interface LessonDraft {
  id: string;
  appliesTo: GrockDomain[];
  principle: string;
  reasoningShift: string;
  thinkingInstruction: string;
  acknowledgmentInstruction: string;
  examples: string;
  sourceKind?: string;
  sourcePhotoHash?: string;
}

/** Amorce une leçon pré-remplie selon le type de cas détecté. */
function draftFromCandidate(c: GrockLessonCandidate): LessonDraft {
  const base: LessonDraft = {
    id: '',
    appliesTo: ['GENERAL'],
    principle: '',
    reasoningShift: '',
    thinkingInstruction: '',
    acknowledgmentInstruction: '',
    examples: '',
    sourceKind: c.kind,
    sourcePhotoHash: c.photoHash ?? undefined,
  };
  if (c.kind === 'variance_cadrage') {
    return {
      ...base,
      id: 'DECISION_ANCREE_SUR_FAITS',
      principle:
        'La responsabilité s’ancre sur les faits visibles, pas sur le cadrage du récit.',
      reasoningShift:
        'Un même désordre ne change pas de responsabilité selon que le locataire parle d’« eau » ou d’« électricité ».',
      thinkingInstruction:
        'Dans thinking, sépare : faits visibles / cadrage annoncé / décision. Ne laisse pas le titre orienter la conclusion.',
      acknowledgmentInstruction:
        'Reste neutre : conclus sur les faits, demande une preuve ciblée si le cadrage ne colle pas à l’image.',
    };
  }
  return base;
}

const SEVERITY_LABEL: Record<string, string> = {
  high: 'CRITIQUE',
  warn: 'À VOIR',
  info: 'INFO',
};

const GrockLearningPage: React.FC = () => {
  const [candidates, setCandidates] = useState<GrockLessonCandidate[]>([]);
  const [analyzed, setAnalyzed] = useState(0);
  const [lessons, setLessons] = useState<GrockLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cand, less] = await Promise.all([
        fetchGrockCandidates(),
        fetchGrockLessons(),
      ]);
      setCandidates(cand.candidates);
      setAnalyzed(cand.analyzed);
      setLessons(less.principles);
    } catch (err) {
      setError(getGrockLearningErrorMessage(err, 'Chargement impossible.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const drafts = useMemo(() => lessons.filter((l) => l.status === 'draft'), [lessons]);
  const validated = useMemo(
    () => lessons.filter((l) => l.status === 'validated'),
    [lessons],
  );

  const toggleDomain = (domain: GrockDomain) => {
    setDraft((d) => {
      if (!d) return d;
      const has = d.appliesTo.includes(domain);
      return {
        ...d,
        appliesTo: has
          ? d.appliesTo.filter((x) => x !== domain)
          : [...d.appliesTo, domain],
      };
    });
  };

  const handlePropose = async () => {
    if (!draft) return;
    if (!draft.id.trim() || !draft.principle.trim()) {
      setError('Un identifiant et un principe sont requis.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await proposeGrockLesson({
        id: draft.id,
        appliesTo: draft.appliesTo.length ? draft.appliesTo : ['GENERAL'],
        principle: draft.principle,
        reasoningShift: draft.reasoningShift,
        thinkingInstruction: draft.thinkingInstruction,
        acknowledgmentInstruction: draft.acknowledgmentInstruction,
        examples: draft.examples
          .split('\n')
          .map((e) => e.trim())
          .filter(Boolean),
        sourceKind: draft.sourceKind,
        sourcePhotoHash: draft.sourcePhotoHash,
      });
      setDraft(null);
      await reload();
    } catch (err) {
      setError(getGrockLearningErrorMessage(err, 'Création de la leçon échouée.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await signGrockLesson(id);
      await reload();
    } catch (err) {
      setError(getGrockLearningErrorMessage(err, 'Signature échouée.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm(`Rejeter la leçon « ${id} » ?`)) return;
    setBusyId(id);
    setError(null);
    try {
      await rejectGrockLesson(id);
      await reload();
    } catch (err) {
      setError(getGrockLearningErrorMessage(err, 'Rejet échoué.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grock-learning">
      <header className="gl-header">
        <h1>Apprentissage Grock — Arbitrage</h1>
        <p className="gl-subtitle">
          Les sondes analysent le journal de décision et remontent les cas incohérents.
          Vous transformez un cas en leçon de doctrine ; elle n’influence Grock qu’une
          fois <strong>signée</strong> (draft → validated). NuclearFlush reste intact.
        </p>
        <p className="gl-meta">
          GROCK_DEDUCTION_LEDGER · {analyzed} tours analysés ·{' '}
          <Link to="/admin/lia-lab" className="gl-link">← Lia-Lab</Link>
        </p>
      </header>

      {error ? <div className="gl-error">{error}</div> : null}

      {loading ? (
        <p className="gl-loading">Analyse du journal…</p>
      ) : (
        <div className="gl-grid">
          <section className="gl-col">
            <h2>Cas à arbitrer ({candidates.length})</h2>
            {candidates.length === 0 ? (
              <div className="gl-empty">Aucun cas détecté. Le raisonnement est stable.</div>
            ) : (
              candidates.map((c, i) => (
                <article key={`${c.kind}-${i}`} className={`gl-card gl-sev-${c.severity}`}>
                  <div className="gl-card-head">
                    <span className={`gl-badge gl-badge-${c.severity}`}>
                      {SEVERITY_LABEL[c.severity] ?? c.severity}
                    </span>
                    <span className="gl-kind">{GROCK_PROBE_LABELS[c.kind] ?? c.kind}</span>
                  </div>
                  <p className="gl-summary">{c.summary}</p>
                  <ul className="gl-evidence">
                    {c.evidence.map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="gl-btn gl-btn-primary"
                    onClick={() => setDraft(draftFromCandidate(c))}
                  >
                    Rédiger une leçon
                  </button>
                </article>
              ))
            )}
          </section>

          <section className="gl-col">
            <h2>Doctrine ({validated.length} active · {drafts.length} en attente)</h2>

            {draft ? (
              <div className="gl-form">
                <h3>Nouvelle leçon (draft)</h3>
                <label>
                  Identifiant
                  <input
                    value={draft.id}
                    onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                    placeholder="EX : DECISION_ANCREE_SUR_FAITS"
                  />
                </label>
                <div className="gl-domains">
                  {GROCK_DOMAINS.map((d) => (
                    <label key={d} className="gl-chk">
                      <input
                        type="checkbox"
                        checked={draft.appliesTo.includes(d)}
                        onChange={() => toggleDomain(d)}
                      />
                      {d}
                    </label>
                  ))}
                </div>
                <label>
                  Principe
                  <textarea
                    value={draft.principle}
                    rows={2}
                    onChange={(e) => setDraft({ ...draft, principle: e.target.value })}
                  />
                </label>
                <label>
                  Déplacement de raisonnement
                  <textarea
                    value={draft.reasoningShift}
                    rows={2}
                    onChange={(e) => setDraft({ ...draft, reasoningShift: e.target.value })}
                  />
                </label>
                <label>
                  Consigne « thinking »
                  <textarea
                    value={draft.thinkingInstruction}
                    rows={2}
                    onChange={(e) =>
                      setDraft({ ...draft, thinkingInstruction: e.target.value })
                    }
                  />
                </label>
                <label>
                  Consigne « parole locataire »
                  <textarea
                    value={draft.acknowledgmentInstruction}
                    rows={2}
                    onChange={(e) =>
                      setDraft({ ...draft, acknowledgmentInstruction: e.target.value })
                    }
                  />
                </label>
                <label>
                  Exemples (un par ligne)
                  <textarea
                    value={draft.examples}
                    rows={3}
                    onChange={(e) => setDraft({ ...draft, examples: e.target.value })}
                  />
                </label>
                <div className="gl-form-actions">
                  <button
                    type="button"
                    className="gl-btn gl-btn-primary"
                    disabled={saving}
                    onClick={() => void handlePropose()}
                  >
                    {saving ? 'Enregistrement…' : 'Créer le draft'}
                  </button>
                  <button
                    type="button"
                    className="gl-btn"
                    disabled={saving}
                    onClick={() => setDraft(null)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : null}

            {drafts.map((l) => (
              <article key={l.id} className="gl-lesson gl-lesson-draft">
                <div className="gl-card-head">
                  <span className="gl-badge gl-badge-warn">DRAFT</span>
                  <strong>{l.id}</strong>
                </div>
                <p className="gl-summary">{l.principle}</p>
                <div className="gl-lesson-actions">
                  <button
                    type="button"
                    className="gl-btn gl-btn-sign"
                    disabled={busyId === l.id}
                    onClick={() => void handleSign(l.id)}
                  >
                    Signer (valider)
                  </button>
                  <button
                    type="button"
                    className="gl-btn gl-btn-reject"
                    disabled={busyId === l.id}
                    onClick={() => void handleReject(l.id)}
                  >
                    Rejeter
                  </button>
                </div>
              </article>
            ))}

            {validated.map((l) => (
              <article key={l.id} className="gl-lesson">
                <div className="gl-card-head">
                  <span className="gl-badge gl-badge-ok">VALIDÉE</span>
                  <strong>{l.id}</strong>
                </div>
                <p className="gl-summary">{l.principle}</p>
                <p className="gl-lesson-meta">
                  {l.appliesTo.join(', ')}
                  {l.signataire ? ` · signée par ${l.signataire}` : ''}
                  {l.signedAt ? ` le ${l.signedAt}` : ''}
                </p>
              </article>
            ))}
          </section>
        </div>
      )}
    </div>
  );
};

export default GrockLearningPage;
