import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  discardGrockLabSession,
  getLabErrorMessage,
  LAB_DIALOGUE_LANGUAGES,
  askGrockPathology,
  sendGrockLabMessage,
  sendGrockLabPhoto,
  startGrockLabSession,
  synthesizeLabSpeech,
  transcribeLabAudio,
  type GrockLabSessionView,
  type GrockPathologyAnswerView,
  type LabDialogueLanguage,
} from '@services/liaLabApi';
import { getErrorMessage } from '@services/apiClient';
import authService from '@services/authService';
import './LiaLabPage.css';

const SETUP_KEY = 'grock-lab-setup-v1';

function extractVisibleGrockText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return text;

  try {
    const parsed = JSON.parse(trimmed) as { acknowledgment?: unknown };
    if (typeof parsed.acknowledgment === 'string' && parsed.acknowledgment.trim()) {
      return parsed.acknowledgment.trim();
    }
  } catch {
    const match = trimmed.match(/"acknowledgment"\s*:\s*"([^"]+)"/s);
    if (match?.[1]?.trim()) {
      return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
    }
  }

  return 'Réponse technique masquée côté locataire. Consultez le panneau Thinking Grock.';
}

const LiaLabPage: React.FC = () => {
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(SETUP_KEY) ?? '{}') as Record<string, string>;
    } catch {
      return {};
    }
  })();

  const [title, setTitle] = useState(saved.title ?? '');
  const [description, setDescription] = useState(saved.description ?? '');
  const [tenantFirstName, setTenantFirstName] = useState(saved.tenantFirstName ?? 'Marie');
  const [language, setLanguage] = useState<LabDialogueLanguage>(
    (saved.language as LabDialogueLanguage) ?? 'fr',
  );
  const [session, setSession] = useState<GrockLabSessionView | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [pathologyQ, setPathologyQ] = useState('');
  const [pathologyA, setPathologyA] = useState<GrockPathologyAnswerView | null>(null);
  const [pathologyBusy, setPathologyBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    localStorage.setItem(
      SETUP_KEY,
      JSON.stringify({ title, description, tenantFirstName, language }),
    );
  }, [title, description, tenantFirstName, language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  const resetConversation = useCallback(() => {
    const sid = session?.sessionId;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSession(null);
    setDraft('');
    setError(null);
    setBusy(false);
    setPathologyA(null);
    if (sid) void discardGrockLabSession(sid).catch(() => undefined);
  }, [session?.sessionId]);

  const playTts = useCallback(async (text: string, lang: LabDialogueLanguage) => {
    try {
      const { audioBase64, mimeType } = await synthesizeLabSpeech(text, lang);
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioRef.current = audio;
      await audio.play();
    } catch {
      /* TTS optionnel */
    }
  }, []);

  const startSession = async () => {
    const t = title.trim();
    const d = description.trim();
    if (!t || !d) {
      setError('Renseignez titre et description du signalement.');
      return;
    }
    if (!authService.isAuthenticated() || authService.getRole() !== 'ADMIN') {
      setError('Lia-Lab réservé aux comptes ADMIN.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const view = await startGrockLabSession({
        title: t,
        description: d,
        tenantFirstName: tenantFirstName.trim() || 'Marie',
        language,
      });
      setSession(view);
      const opening = [...view.messages].reverse().find((m) => m.role === 'grock');
      if (opening?.text) void playTts(opening.text, language);
    } catch (e) {
      setError(getLabErrorMessage(e, 'Impossible de démarrer Grock.'));
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!session?.sessionId || !text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const view = await sendGrockLabMessage(session.sessionId, text.trim());
      setSession(view);
      setDraft('');
      const last = [...view.messages].reverse().find((m) => m.role === 'grock');
      if (last?.text) void playTts(last.text, language);
    } catch (e) {
      setError(getLabErrorMessage(e, 'Erreur envoi message.'));
    } finally {
      setBusy(false);
    }
  };

  const sendPhoto = async (file: File, caption?: string) => {
    if (!session?.sessionId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const view = await sendGrockLabPhoto(session.sessionId, file, caption);
      setSession(view);
      setDraft('');
      const last = [...view.messages].reverse().find((m) => m.role === 'grock');
      if (last?.text) void playTts(last.text, language);
    } catch (e) {
      setError(getLabErrorMessage(e, 'Erreur envoi photo.'));
    } finally {
      setBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const onPhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void sendPhoto(file, draft.trim() || undefined);
  };

  const loadBuanderiePreset = () => {
    setTitle('Fuite buanderie');
    setDescription('Fuite d\'eau dans la buanderie.');
    setDraft("J'ai de l'eau dans ma buanderie.");
  };

  const askPathology = async () => {
    const q = pathologyQ.trim();
    if (!q || pathologyBusy) return;
    setPathologyBusy(true);
    setError(null);
    try {
      const res = await askGrockPathology(q, language);
      setPathologyA(res);
    } catch (e) {
      setError(getLabErrorMessage(e, 'Impossible de répondre à la question pathologie.'));
    } finally {
      setPathologyBusy(false);
    }
  };

  return (
    <div className="lia-lab lia-lab-page">
      <header className="lia-lab-header">
        <div>
          <h2>Grock — Intercom mono-agent</h2>
          <p className="lia-lab-sub">
            Message Marie · bibliothèque AFPOL · 5 derniers tickets Supabase · vision Pixtral (photos).
            Amnésie totale à chaque nouvelle conversation.
          </p>
        </div>
        <div className="lia-lab-header-actions">
          <Link to="/admin" className="lia-lab-link">
            ← Dashboard
          </Link>
          <button type="button" className="lia-lab-reset-btn" onClick={resetConversation}>
            Nouvelle conversation
          </button>
        </div>
      </header>

      {error ? <p className="lia-lab-error">{error}</p> : null}

      {!session ? (
        <section className="lia-lab-setup">
          <label>
            Titre signalement
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <div className="lia-lab-setup-row">
            <label>
              Prénom locataire (Supabase)
              <input value={tenantFirstName} onChange={(e) => setTenantFirstName(e.target.value)} />
            </label>
            <label>
              Langue
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LabDialogueLanguage)}
              >
                {LAB_DIALOGUE_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="lia-lab-setup-actions">
            <button type="button" onClick={loadBuanderiePreset}>
              Preset buanderie
            </button>
            <button type="button" className="lia-lab-primary" disabled={busy} onClick={() => void startSession()}>
              {busy ? 'Démarrage…' : 'Démarrer Grock'}
            </button>
          </div>
        </section>
      ) : (
        <div className="lia-lab-grock-grid">
          <section className="lia-lab-chat" aria-label="Intercom Grock">
            <h3>Intercom Grock · {session.tenantFirstName}</h3>
            <p className="lia-lab-meta">
              {session.title} — modèle {session.model ?? 'Mistral'}
              {session.visionModel ? ` · vision ${session.visionModel}` : ''}
            </p>
            <div className="lia-lab-messages">
              {session.messages.map((m, i) => (
                <div
                  key={`${m.at}-${i}`}
                  className={`lia-lab-bubble ${m.role === 'grock' ? 'lia' : 'tenant'}`}
                >
                  <strong>{m.role === 'grock' ? 'Grock' : session.tenantFirstName} · </strong>
                  {m.role === 'grock' ? extractVisibleGrockText(m.text) : m.text}
                  {m.imagePreview ? (
                    <img
                      className="lia-lab-photo-preview"
                      src={m.imagePreview}
                      alt="Photo envoyée par le locataire"
                    />
                  ) : null}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="lia-lab-compose">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message de Marie… (légende optionnelle avant photo)"
                disabled={busy}
                rows={2}
              />
              <div className="lia-lab-compose-actions">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  className="lia-lab-photo-input"
                  disabled={busy}
                  onChange={onPhotoSelected}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => photoInputRef.current?.click()}
                  title="Envoyer une photo — perception Pixtral"
                >
                  {busy ? 'Analyse…' : '📷 Photo'}
                </button>
                <button
                  type="button"
                  className="lia-lab-primary"
                  disabled={busy || !draft.trim()}
                  onClick={() => void sendMessage(draft)}
                >
                  Envoyer
                </button>
              </div>
            </div>
          </section>

          <aside className="lia-lab-side">
            <section className="lia-lab-pathology" aria-label="Consultation pathologie">
              <h3>Consultation pathologie (sans scénario)</h3>
              <p className="lia-lab-muted">
                Pose une question directe (ex: « Infiltration au plafond : quelles causes probables ? »).
              </p>
              <textarea
                value={pathologyQ}
                onChange={(e) => setPathologyQ(e.target.value)}
                placeholder="Votre question…"
                rows={3}
                disabled={pathologyBusy}
              />
              <div className="lia-lab-compose-actions" style={{ marginTop: 8 }}>
                <button type="button" disabled={pathologyBusy || !pathologyQ.trim()} onClick={() => void askPathology()}>
                  {pathologyBusy ? 'Analyse…' : 'Répondre'}
                </button>
                {pathologyA?.model ? (
                  <span className="lia-lab-meta">modèle {pathologyA.model}</span>
                ) : null}
              </div>
              {pathologyA?.answer ? (
                <pre className="lia-lab-perception-pre" style={{ marginTop: 10 }}>
                  {pathologyA.answer}
                </pre>
              ) : null}
            </section>

            <section className="lia-lab-state" aria-label="État conversationnel Grock">
              <h3>[État Grock]</h3>
              <div className="lia-lab-state-row">
                <span>state</span>
                <strong>{session.state ?? '—'}</strong>
              </div>
              <div className="lia-lab-state-row">
                <span>next_action</span>
                <strong>{session.nextAction ?? '—'}</strong>
              </div>
            </section>

            <section className="lia-lab-thinking" aria-label="Thinking Grock">
              <h3>[Thinking Grock]</h3>
              {session.thinking ? (
                <pre className="lia-lab-thinking-pre">{session.thinking}</pre>
              ) : (
                <p className="lia-lab-muted">
                  Aucun raisonnement structuré reçu pour le moment.
                </p>
              )}
            </section>

            <section className="lia-lab-perception" aria-label="Perception visuelle brute">
              <h3>[Perception Visuelle Brute]</h3>
              {session.visualPerception ? (
                <>
                  {session.visionModel ? (
                    <p className="lia-lab-meta">Modèle vision : {session.visionModel}</p>
                  ) : null}
                  <pre className="lia-lab-perception-pre">{session.visualPerception}</pre>
                </>
              ) : (
                <p className="lia-lab-muted">
                  Aucune photo analysée. Envoyez une image pour que Grock ouvre les yeux sur la scène.
                </p>
              )}
            </section>

            <h3>Mémoire Marie (Supabase)</h3>
            <p className="lia-lab-meta">
              {session.ticketHistory.length} ticket(s) chargé(s) au démarrage — hors tests labo.
            </p>
            {session.ticketHistory.length === 0 ? (
              <p className="lia-lab-muted">Aucun ticket antérieur pour ce prénom.</p>
            ) : (
              <ul className="lia-lab-history">
                {session.ticketHistory.map((t) => (
                  <li key={`${t.createdAt}-${t.title}`}>
                    <strong>
                      il y a {t.daysAgo}j · {t.status}
                    </strong>
                    <div>{t.title}</div>
                    <div className="lia-lab-muted">{t.description.slice(0, 120)}</div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default LiaLabPage;
