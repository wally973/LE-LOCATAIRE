import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DOCTRINE_AUTHOR_LABELS,
  fetchPendingDoctrineLessons,
  getDoctrineLedgerErrorMessage,
  rejectDoctrineLesson,
  signDoctrineLesson,
  type DoctrineLedgerEntry,
} from '@services/doctrineLedgerApi';
import './DoctrineRegistryPage.css';

function formatLessonDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const DoctrineRegistryPage: React.FC = () => {
  const [lessons, setLessons] = useState<DoctrineLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pending = await fetchPendingDoctrineLessons();
      setLessons(pending);
    } catch (err) {
      setError(getDoctrineLedgerErrorMessage(err, 'Impossible de charger le registre.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSign = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await signDoctrineLesson(id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(getDoctrineLedgerErrorMessage(err, 'Signature échouée.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Rejeter définitivement cette leçon ?')) return;
    setBusyId(id);
    setError(null);
    try {
      await rejectDoctrineLesson(id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(getDoctrineLedgerErrorMessage(err, 'Rejet échoué.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="doctrine-registry">
      <header className="doctrine-registry-header">
        <h1>Registre de Sagesse</h1>
        <p className="doctrine-registry-subtitle">
          Gouvernance de la Doctrine — leçons capturées en Lia-Lab, en attente de votre sceau
          d&apos;Architecte avant d&apos;entrer dans la Loi permanente de Jarvis.
        </p>
        <p className="doctrine-registry-meta">JARVIS_DOCTRINE_LEDGER · Phase C</p>
      </header>

      {error ? <div className="doctrine-registry-error">{error}</div> : null}

      <div className="doctrine-registry-stats">
        <div className="doctrine-registry-stat">
          <strong>{lessons.length}</strong>
          en attente de signature
        </div>
        <div className="doctrine-registry-stat">
          <Link to="/admin/lia-lab" style={{ color: 'var(--dr-accent)', fontSize: '0.9rem' }}>
            ← Retour au Lia-Lab
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="doctrine-registry-loading">Ouverture du registre…</p>
      ) : lessons.length === 0 ? (
        <div className="doctrine-registry-empty">
          <p>Aucune leçon en attente.</p>
          <p style={{ marginTop: 8, fontSize: '0.9rem' }}>
            Les agents proposeront de nouvelles entrées après chaque délibération réussie dans le
            Lia-Lab.
          </p>
        </div>
      ) : (
        <div className="doctrine-registry-list">
          {lessons.map((lesson) => (
            <article key={lesson.id} className="doctrine-registry-scroll">
              <div className="doctrine-registry-scroll-head">
                <h2>{lesson.title}</h2>
                <div className="doctrine-registry-badges">
                  <span className="doctrine-registry-badge doctrine-registry-badge--pending">
                    PENDING
                  </span>
                  <span className="doctrine-registry-badge">
                    {DOCTRINE_AUTHOR_LABELS[lesson.author] ?? lesson.author}
                  </span>
                </div>
              </div>
              <p className="doctrine-registry-body">{lesson.body}</p>
              <footer className="doctrine-registry-foot">
                <span className="doctrine-registry-date">
                  {formatLessonDate(lesson.createdAt)}
                  {lesson.sessionRef ? ` · session ${lesson.sessionRef.slice(0, 8)}…` : ''}
                </span>
                <div className="doctrine-registry-actions">
                  <button
                    type="button"
                    className="doctrine-registry-btn doctrine-registry-btn--sign"
                    disabled={busyId === lesson.id}
                    onClick={() => void handleSign(lesson.id)}
                  >
                    Signer la loi
                  </button>
                  <button
                    type="button"
                    className="doctrine-registry-btn doctrine-registry-btn--reject"
                    disabled={busyId === lesson.id}
                    onClick={() => void handleReject(lesson.id)}
                  >
                    Rejeter
                  </button>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoctrineRegistryPage;
