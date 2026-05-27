import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLabSession,
  runLabOpening,
  sendLabMessage,
  synthesizeLabSpeech,
  transcribeLabAudio,
  type LabSessionView,
  type LiaLabVisualization,
} from '@services/liaLabApi';
import { getErrorMessage } from '@services/apiClient';
import './LiaLabPage.css';

const PRESETS: { label: string; title: string; description: string }[] = [
  {
    label: 'Créole — urgence plomberie',
    title: 'Eau qui coule',
    description: 'Bonjou, dlo ap koule anpil sou lavabo la, mwen pa konnen ki koté li soti.',
  },
  {
    label: 'Marie — porte gâchée',
    title: 'Porte qui ne ferme plus',
    description:
      'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
  },
  {
    label: 'Condensation / VMC',
    title: 'Humidité chambre',
    description:
      'Forte condensation sur les fenêtres, odeur de moisi, VMC qui semble ne plus tourner.',
  },
];

function VisualizationConsole({ viz }: { viz: LiaLabVisualization | null }) {
  if (!viz) {
    return (
      <div className="lia-lab-console">
        <p style={{ color: 'var(--lab-muted)' }}>
          Démarrez une session pour afficher les capteurs Jarvis.
        </p>
      </div>
    );
  }

  return (
    <div className="lia-lab-console">
      <section>
        <h4>Mode urgence</h4>
        {viz.urgencyMode ? (
          <span className="lia-lab-tag urgent">{viz.urgencyMode}</span>
        ) : (
          <span className="lia-lab-tag">— standard —</span>
        )}
      </section>

      <section>
        <h4>Flux actifs</h4>
        {viz.activeFlows.length === 0 ? (
          <span className="lia-lab-tag">aucun détecté</span>
        ) : (
          viz.activeFlows.map((f) => (
            <span key={f} className="lia-lab-tag flow">
              {f}
            </span>
          ))
        )}
      </section>

      <section>
        <h4>Modèles mentaux (VISUAL_LOGIC)</h4>
        {viz.mentalModels.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--lab-muted)' }}>En attente de signes…</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {viz.mentalModels.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4>Capteurs</h4>
        <span className="lia-lab-tag">Lot : {viz.detectedLot}</span>
        <span className="lia-lab-tag">Langue : {viz.language}</span>
        <span className="lia-lab-tag">Phase : {viz.intakePhase}</span>
        {viz.handoffRecommended ? (
          <span className="lia-lab-tag urgent">Handoff secteur</span>
        ) : null}
      </section>

      <section>
        <h4>KB panne (AFPOL)</h4>
        {viz.kbPanneLabel ? (
          <>
            <p style={{ margin: '4px 0' }}>
              {viz.kbPanneId} — {viz.kbPanneLabel}
            </p>
            <p style={{ margin: '4px 0', color: 'var(--lab-muted)' }}>
              Causes actives : {viz.kbCausesActive.join(' · ') || '—'}
            </p>
            {viz.kbCausesEliminated.length > 0 ? (
              <p style={{ margin: '4px 0', color: 'var(--lab-muted)' }}>
                Éliminées : {viz.kbCausesEliminated.join(', ')}
              </p>
            ) : null}
          </>
        ) : (
          <p style={{ margin: 0, color: 'var(--lab-muted)' }}>Organisateur non verrouillé</p>
        )}
      </section>

      <section>
        <h4>Documents / référentiels consultés</h4>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {viz.afpolRefs.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      {viz.visualizationNote ? (
        <section>
          <h4>Note de visualisation Jarvis</h4>
          <p style={{ margin: 0 }}>{viz.visualizationNote}</p>
        </section>
      ) : null}

      <section>
        <h4>jarvisFacts (état partagé)</h4>
        <dl className="lia-lab-facts">
          {Object.keys(viz.jarvisFacts).length === 0 ? (
            <dd style={{ margin: 0, color: 'var(--lab-muted)' }}>vide</dd>
          ) : (
            Object.entries(viz.jarvisFacts).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </React.Fragment>
            ))
          )}
        </dl>
      </section>
    </div>
  );
}

const LiaLabPage: React.FC = () => {
  const [title, setTitle] = useState(PRESETS[0].title);
  const [description, setDescription] = useState(PRESETS[0].description);
  const [tenantFirstName, setTenantFirstName] = useState('Marie');
  const [session, setSession] = useState<LabSessionView | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  const applyPreset = (p: (typeof PRESETS)[0]) => {
    setTitle(p.title);
    setDescription(p.description);
    setSession(null);
    setDraft('');
    setError(null);
  };

  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = session?.sessionId ?? null;

  const playTts = useCallback(async (text: string, language: 'fr' | 'gcf') => {
    if (!text.trim()) return;
    setSpeaking(true);
    try {
      const { audioBase64, mimeType } = await synthesizeLabSpeech(text, language);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch (e) {
      setSpeaking(false);
      setError(getErrorMessage(e, 'Synthèse vocale indisponible (ElevenLabs).'));
    }
  }, []);

  const sendText = useCallback(
    async (text: string, sessionId?: string) => {
      const sid = sessionId ?? session?.sessionId;
      if (!sid || !text.trim() || busy) return;
      setBusy(true);
      setError(null);
      try {
        const view = await sendLabMessage(sid, text.trim());
        setSession(view);
        setDraft('');
        const lastLia = [...view.messages].reverse().find((m) => m.role === 'lia');
        if (lastLia?.text) {
          void playTts(lastLia.text, view.visualization.language === 'gcf' ? 'gcf' : 'fr');
        }
      } catch (e) {
        setError(getErrorMessage(e, 'Erreur envoi message.'));
      } finally {
        setBusy(false);
      }
    },
    [session?.sessionId, playTts, busy],
  );

  const startSession = async () => {
    setBusy(true);
    setError(null);
    try {
      let view = await createLabSession({
        title: title.trim(),
        description: description.trim(),
        tenantFirstName: tenantFirstName.trim() || 'Marie',
      });
      view = await runLabOpening(view.sessionId);
      setSession(view);
      setDraft('');
      const openingLia = [...view.messages].reverse().find((m) => m.role === 'lia');
      if (openingLia?.text) {
        void playTts(
          openingLia.text,
          view.visualization.language === 'gcf' ? 'gcf' : 'fr',
        );
      }
    } catch (e) {
      setError(getErrorMessage(e, 'Impossible de démarrer la session Lia-Lab.'));
    } finally {
      setBusy(false);
    }
  };

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
    setRecording(false);
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 200) return;
        setBusy(true);
        try {
          const text = await transcribeLabAudio(blob);
          setDraft((d) => (d ? `${d} ${text}` : text));
          const sid = sessionIdRef.current;
          if (sid) {
            await sendLabMessage(sid, text.trim()).then((view) => {
              setSession(view);
              setDraft('');
              const lastLia = [...view.messages].reverse().find((m) => m.role === 'lia');
              if (lastLia?.text) {
                void playTts(
                  lastLia.text,
                  view.visualization.language === 'gcf' ? 'gcf' : 'fr',
                );
              }
            });
          }
        } catch (e) {
          setError(getErrorMessage(e, 'Transcription échouée (Groq Whisper).'));
        } finally {
          setBusy(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (e) {
      setError(getErrorMessage(e, 'Micro inaccessible.'));
    }
  };

  const toggleMic = () => {
    if (recording) stopRecording();
    else void startRecording();
  };

  const lastLiaMessage = [...(session?.messages ?? [])]
    .reverse()
    .find((m) => m.role === 'lia');

  return (
    <div className="lia-lab">
      <header className="lia-lab-header">
        <div>
          <h2>Lia-Lab — Intercom Jarvis</h2>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--lab-muted)' }}>
            Voice-first · STT Groq · TTS ElevenLabs · sandbox sans ticket réel
          </p>
        </div>
        <div className="lia-lab-presets">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {error ? <div className="lia-lab-error">{error}</div> : null}

      <div className="lia-lab-grid">
        <div className="lia-lab-panel">
          <div className="lia-lab-panel-title">Vue locataire (chat)</div>

          {!session ? (
            <div className="lia-lab-setup">
              <input
                value={tenantFirstName}
                onChange={(e) => setTenantFirstName(e.target.value)}
                placeholder="Prénom locataire"
                aria-label="Prénom"
              />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre signalement"
                aria-label="Titre"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description initiale"
                aria-label="Description"
              />
              <div className="lia-lab-setup-actions">
                <button type="button" disabled={busy} onClick={() => void startSession()}>
                  {busy ? 'Connexion…' : 'Démarrer Jarvis'}
                </button>
                <button
                  type="button"
                  className={`lia-lab-icon-btn ${recording ? 'recording' : ''}`}
                  onClick={toggleMic}
                  title="Dicter la description (STT)"
                  aria-label="Micro"
                >
                  🎤
                </button>
              </div>
            </div>
          ) : null}

          <div className="lia-lab-messages">
            {session?.messages.map((m, i) => (
              <div
                key={`${m.at}-${i}`}
                className={`lia-lab-bubble ${m.role === 'tenant' ? 'tenant' : 'lia'}`}
              >
                {m.text}
                <div className="lia-lab-bubble-meta">
                  {m.role === 'tenant' ? 'Locataire' : 'Jarvis / Lia'}
                  {m.uiStatusLabel ? ` · ${m.uiStatusLabel}` : ''}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {session ? (
            <>
              <div className="lia-lab-status">
                Session {session.sessionId.slice(0, 8)}… · {busy ? 'traitement…' : 'prêt'}
              </div>
              <div className="lia-lab-compose">
                <button
                  type="button"
                  className={`lia-lab-icon-btn ${recording ? 'recording' : ''}`}
                  onClick={toggleMic}
                  disabled={busy}
                  title="Parler (STT)"
                  aria-label="Micro"
                >
                  🎤
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Écrire ou dicter…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendText(draft);
                    }
                  }}
                  disabled={busy}
                />
                <button
                  type="button"
                  className={`lia-lab-icon-btn ${speaking ? 'speaking' : ''}`}
                  disabled={!lastLiaMessage?.text || busy}
                  onClick={() =>
                    void playTts(
                      lastLiaMessage!.text,
                      session.visualization.language === 'gcf' ? 'gcf' : 'fr',
                    )
                  }
                  title="Relire dernière réponse (TTS)"
                  aria-label="Haut-parleur"
                >
                  🔊
                </button>
                <button
                  type="button"
                  className="lia-lab-icon-btn"
                  disabled={busy || !draft.trim()}
                  onClick={() => void sendText(draft)}
                  title="Envoyer"
                  aria-label="Envoyer"
                >
                  ➤
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="lia-lab-panel">
          <div className="lia-lab-panel-title">Console de visualisation (ce que Jarvis voit)</div>
          <VisualizationConsole viz={session?.visualization ?? null} />
        </div>
      </div>
    </div>
  );
};

export default LiaLabPage;
