import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLabErrorMessage,
  LAB_DIALOGUE_LANGUAGES,
  startLabSession,
  sendLabMessage,
  synthesizeLabSpeech,
  transcribeLabAudio,
  type LabDialogueLanguage,
  type LabSessionView,
  type LiaLabVisualization,
} from '@services/liaLabApi';
import { getErrorMessage } from '@services/apiClient';
import authService from '@services/authService';
import './LiaLabPage.css';

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
        {(viz.activeFlowLabels ?? viz.activeFlows).length === 0 ? (
          <span className="lia-lab-tag">aucun détecté</span>
        ) : (
          (viz.activeFlowLabels ?? viz.activeFlows).map((f) => (
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
        <span className="lia-lab-tag">
          Langue dialogue (choix locataire) : {viz.dialogueLanguageLabel ?? viz.language}
        </span>
        {viz.tenantLanguageLabel &&
        viz.tenantLanguageLabel !== viz.dialogueLanguageLabel ? (
          <span className="lia-lab-tag">Locataire : {viz.tenantLanguageLabel}</span>
        ) : null}
        <span className="lia-lab-tag">
          Phase : {viz.intakePhaseLabel ?? viz.intakePhase}
        </span>
        {viz.handoffRecommended ? (
          <span className="lia-lab-tag urgent">Handoff secteur</span>
        ) : null}
      </section>

      {viz.housingPerspective ? (
        <section>
          <h4>Perspective logement (inscription)</h4>
          <p style={{ margin: 0, color: 'var(--lab-muted)', fontSize: 13 }}>{viz.housingPerspective}</p>
        </section>
      ) : null}

      {viz.councilEchoes && viz.councilEchoes.length > 0 ? (
        <section className="lia-lab-council">
          <h4>Équipe Lia — brief avant Groq (Jarvis parle seul au locataire)</h4>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {viz.councilEchoes.map((e, i) => (
              <li
                key={`${e.agent}-${i}`}
                className={`lia-lab-council-echo${
                  e.agent === 'Archiviste' || e.agent === 'Juriste (console)'
                    ? ' lia-lab-council-echo--juriste'
                    : e.agent === 'Diagnostiqueur'
                      ? ' lia-lab-council-echo--pathologiste'
                      : ''
                }`}
              >
                <strong>{e.agent}</strong>
                <span className="lia-lab-tag flow">{e.heard}</span>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--lab-muted)' }}>{e.insight}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h4>Simulation 3D (Jarvis Engine)</h4>
        {viz.simulationDomain ? (
          <>
            <span className="lia-lab-tag flow">
              {viz.simulationDomainLabel ?? viz.simulationDomain}
            </span>
            {viz.scene3DRows && viz.scene3DRows.length > 0 ? (
              <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
                {viz.scene3DRows.map((row) => (
                  <li key={row.label}>
                    {row.label} : {row.value}
                  </li>
                ))}
              </ul>
            ) : viz.scene3D ? (
              <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
                {Object.entries(viz.scene3D)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <li key={k}>
                      {k} : {v}
                    </li>
                  ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p style={{ margin: 0, color: 'var(--lab-muted)' }}>Scène en cours d’instanciation…</p>
        )}
      </section>

      {viz.physicalHypotheses && viz.physicalHypotheses.length > 0 ? (
        <section>
          <h4>Ce que Lia visualise (hypothèses physiques)</h4>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {viz.physicalHypotheses.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h4>Hypothèses actives / écartées</h4>
        <p style={{ margin: '4px 0', color: 'var(--lab-muted)' }}>
          Actives : {viz.kbCausesActive.join(' · ') || '—'}
        </p>
        {viz.kbCausesEliminated.length > 0 ? (
          <p style={{ margin: '4px 0', color: 'var(--lab-muted)' }}>
            Écartées : {viz.kbCausesEliminated.join(', ')}
          </p>
        ) : null}
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
          {(viz.jarvisFactsConsole ?? Object.entries(viz.jarvisFacts)).length === 0 ? (
            <dd style={{ margin: 0, color: 'var(--lab-muted)' }}>vide</dd>
          ) : viz.jarvisFactsConsole ? (
            viz.jarvisFactsConsole.map((row) => (
              <React.Fragment key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </React.Fragment>
            ))
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tenantFirstName, setTenantFirstName] = useState('Marie');
  const [residenceUnitNumber, setResidenceUnitNumber] = useState('5F');
  const [dialogueLanguage, setDialogueLanguage] = useState<LabDialogueLanguage>('fr');
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

  const resetConversation = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
    setRecording(false);
    setSession(null);
    setDraft('');
    setError(null);
    setBusy(false);
  };

  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = session?.sessionId ?? null;

  const playTts = useCallback(async (text: string, language: LabDialogueLanguage) => {
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
          void playTts(lastLia.text, view.visualization.language);
        }
      } catch (e) {
        setError(getLabErrorMessage(e, 'Erreur envoi message.'));
      } finally {
        setBusy(false);
      }
    },
    [session?.sessionId, playTts, busy],
  );

  const startSession = async () => {
    const t = title.trim();
    const d = description.trim();
    if (!t || !d) {
      setError('Renseignez le titre et la description avant de démarrer Jarvis.');
      return;
    }
    if (!authService.isAuthenticated()) {
      setError('Connectez-vous avec un compte ADMIN pour utiliser Lia-Lab.');
      return;
    }
    if (authService.getRole() !== 'ADMIN') {
      setError('Lia-Lab est réservé aux comptes ADMIN.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const view = await startLabSession({
        title: t,
        description: d,
        tenantFirstName: tenantFirstName.trim() || 'Marie',
        language: dialogueLanguage,
        residenceUnitNumber: residenceUnitNumber.trim() || undefined,
      });
      if (!view.messages?.length) {
        setError('Jarvis n’a renvoyé aucun message — redémarrez le backend puis réessayez.');
        return;
      }
      setSession(view);
      setDraft('');
      const openingLia = [...view.messages].reverse().find((m) => m.role === 'lia');
      if (openingLia?.text) {
        void playTts(openingLia.text, view.visualization.language);
      }
    } catch (e) {
      setError(getLabErrorMessage(e, 'Impossible de démarrer la session Lia-Lab.'));
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
                void playTts(lastLia.text, view.visualization.language);
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
        {session ? (
          <button type="button" className="lia-lab-reset-btn" onClick={resetConversation}>
            Nouvelle conversation
          </button>
        ) : null}
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
              <label className="lia-lab-lang-label" htmlFor="lia-lab-lang">
                Langue du dialogue Jarvis (choix locataire)
              </label>
              <select
                id="lia-lab-lang"
                value={dialogueLanguage}
                onChange={(e) =>
                  setDialogueLanguage(e.target.value as LabDialogueLanguage)
                }
                aria-label="Langue du dialogue"
              >
                {LAB_DIALOGUE_LANGUAGES.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <label className="lia-lab-lang-label" htmlFor="lia-lab-unit">
                Lot locataire (inscription)
              </label>
              <input
                id="lia-lab-unit"
                value={residenceUnitNumber}
                onChange={(e) => setResidenceUnitNumber(e.target.value)}
                placeholder="Ex. 5F (collectif) ou 26 (plein pied)"
                aria-label="Numéro de lot"
                title="5F ≈ bâtiment collectif · 26 ≈ plein pied"
              />
              <p className="lia-lab-unit-hint">
                5F → collectif (voisins, parties communes) · 26 → plein pied (piste locale)
              </p>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre signalement (libre)"
                aria-label="Titre"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez votre situation comme le locataire…"
                aria-label="Description"
              />
              <div className="lia-lab-setup-actions">
                <button
                  type="button"
                  disabled={busy || !title.trim() || !description.trim()}
                  onClick={() => void startSession()}
                >
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
                    void playTts(lastLiaMessage!.text, session.visualization.language)
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
          <div className="lia-lab-panel-title">
            Console de visualisation (expert — français)
          </div>
          <VisualizationConsole viz={session?.visualization ?? null} />
        </div>
      </div>
    </div>
  );
};

export default LiaLabPage;
