import { useEffect, useState } from 'react';
import {
  notificationsApi,
  syncWebPushTokenAfterLogin,
  type NotificationSettings,
} from '@services/notificationsApi';
import { getErrorMessage } from '@services/apiClient';

/** Préférences email / push (Sprint 6B). */
export function NotificationSettingsCard() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await notificationsApi.getSettings();
        if (!cancelled) setSettings(data);
        await syncWebPushTokenAfterLogin();
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, 'Chargement impossible'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await notificationsApi.updateSettings({
        emailEnabled: settings.emailEnabled,
        pushEnabled: settings.pushEnabled,
      });
      setSettings(updated);
    } catch (e) {
      setError(getErrorMessage(e, 'Enregistrement impossible'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Chargement des préférences…</p>;
  if (!settings) return <p className="text-danger">{error ?? 'Indisponible'}</p>;

  return (
    <section className="card" style={{ maxWidth: 480, padding: 16 }}>
      <h3>Notifications</h3>
      {error && <p className="text-danger">{error}</p>}
      <label style={{ display: 'block', marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={settings.emailEnabled}
          onChange={(e) =>
            setSettings({ ...settings, emailEnabled: e.target.checked })
          }
        />{' '}
        Email
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={settings.pushEnabled}
          onChange={(e) =>
            setSettings({ ...settings, pushEnabled: e.target.checked })
          }
        />{' '}
        Push (jeton web enregistré à la connexion)
      </label>
      <button type="button" disabled={saving} onClick={save}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </section>
  );
}
