import React, { useEffect, useState } from 'react';
import {
  getAvatarOverlayEnabled,
  setAvatarOverlayEnabled,
} from '@hooks/useLocataireAvatarSettings';
import {
  getRgpdStrictAiMode,
  setRgpdStrictAiMode,
} from '@hooks/ai/useRgpdStrictAiPrefs';
import { useAvatarCoach } from '@/context/AvatarCoachContext';
import type { SupportedLocale } from '@hooks/ai/useMultilingualAI';
import {
  deleteMyAiDiagnosticHistory,
} from '@services/aiDiagnosticsApi';
import { getErrorMessage } from '@services/apiClient';

/** Paramètres locataire : avatar coach + essai du pipeline IA (bride incluse). */
const LocataireSettingsPage: React.FC = () => {
  const { runAssistantPipeline } = useAvatarCoach();
  const [avatarOn, setAvatarOn] = useState(getAvatarOverlayEnabled);
  const [rgpdStrict, setRgpdStrict] = useState(getRgpdStrictAiMode);
  const [tryText, setTryText] = useState('');
  const [locale, setLocale] = useState<SupportedLocale>('fr');
  const [lastResult, setLastResult] = useState<string>('');
  const [purgeMsg, setPurgeMsg] = useState<string>('');

  useEffect(() => {
    const fn = () => setAvatarOn(getAvatarOverlayEnabled());
    window.addEventListener('locataire-avatar-settings-changed', fn);
    return () => window.removeEventListener('locataire-avatar-settings-changed', fn);
  }, []);

  useEffect(() => {
    const onRgpd = () => setRgpdStrict(getRgpdStrictAiMode());
    window.addEventListener('le-locataire:rgpd-strict-ai-changed', onRgpd);
    return () =>
      window.removeEventListener('le-locataire:rgpd-strict-ai-changed', onRgpd);
  }, []);

  const runTry = () => {
    const res = runAssistantPipeline(tryText, {
      locale,
      skipAiDiagnosticRecord: true,
    });
    if (res.kind === 'ok') {
      setLastResult(res.output);
    } else {
      setLastResult(res.guard.safeMessage ?? '');
    }
  };

  const purgeAiHistory = async () => {
    setPurgeMsg('');
    try {
      const r = await deleteMyAiDiagnosticHistory();
      setPurgeMsg(`Historique IA supprimé (${r.deleted} enregistrements).`);
    } catch (e) {
      setPurgeMsg(getErrorMessage(e, 'Suppression impossible.'));
    }
  };

  return (
    <div className="container">
      <h1>Paramètres</h1>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={avatarOn}
              onChange={(e) => {
                setAvatarOverlayEnabled(e.target.checked);
                setAvatarOn(e.target.checked);
              }}
            />{' '}
            Afficher l’avatar assistant (coach)
          </label>
        </div>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          L’avatar vous guide sur les pages principales. Vous pouvez le masquer
          à tout moment.
        </p>
      </div>

      <div className="card" style={{ marginTop: 24, maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Confidentialité &amp; IA</h2>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={rgpdStrict}
              onChange={(e) => {
                setRgpdStrictAiMode(e.target.checked);
                setRgpdStrict(e.target.checked);
              }}
            />{' '}
            Mode RGPD strict (refus automatique si données personnelles détectées
            dans le champ assistant)
          </label>
        </div>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          Sans ce mode, évitez d’insérer adresse précise, e-mail ou numéro de
          téléphone dans les questions envoyées au coach.
        </p>
        <button type="button" className="secondary" onClick={purgeAiHistory}>
          Supprimer mon historique IA
        </button>
        {purgeMsg ? (
          <p style={{ marginTop: 12, fontSize: 14 }}>{purgeMsg}</p>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 24, maxWidth: 560 }}>
        <h2 style={{ marginTop: 0 }}>Tester l’assistant (pipeline complet)</h2>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          La bride limite les sujets au logement et à l’application. En cas de
          refus, l’avatar affiche le message standard.
        </p>
        <div className="form-group">
          <label htmlFor="locale-pick">Langue d’affichage</label>
          <select
            id="locale-pick"
            value={locale}
            onChange={(e) => setLocale(e.target.value as SupportedLocale)}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ht">Kreyòl ayisyen</option>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="es-DO">Español (Rep. Dominicana)</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="try-assistant">Votre question</label>
          <textarea
            id="try-assistant"
            rows={4}
            value={tryText}
            onChange={(e) => setTryText(e.target.value)}
            placeholder="Ex. J’ai une humidité dans mon logement, à qui m’adresser ?"
          />
        </div>
        <button type="button" className="primary" onClick={runTry}>
          Lancer le pipeline
        </button>
        {lastResult ? (
          <pre
            style={{
              marginTop: 16,
              whiteSpace: 'pre-wrap',
              fontSize: 13,
              background: '#f8fafc',
              padding: 12,
              borderRadius: 8,
            }}
          >
            {lastResult}
          </pre>
        ) : null}
      </div>
    </div>
  );
};

export default LocataireSettingsPage;
