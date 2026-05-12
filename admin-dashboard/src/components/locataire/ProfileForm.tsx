import React, { useEffect, useState } from 'react';

export interface ProfileFormValues {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  currentPassword: string;
  newPassword: string;
}

interface Props {
  loadProfile: () => Promise<ProfileFormValues>;
  onSave: (values: ProfileFormValues) => Promise<void>;
}

export const ProfileForm: React.FC<Props> = ({ loadProfile, onSave }) => {
  const [values, setValues] = useState<ProfileFormValues>({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    currentPassword: '',
    newPassword: '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    loadProfile().then(setValues).catch(() => {});
  }, [loadProfile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErr('');
      await onSave(values);
      setMsg('Profil mis à jour');
      setValues((v) => ({ ...v, currentPassword: '', newPassword: '' }));
    } catch (ex: unknown) {
      setMsg('');
      setErr(ex instanceof Error ? ex.message : 'Sauvegarde impossible');
    }
  };

  const set = (k: keyof ProfileFormValues, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  return (
    <>
      {err ? <div className="alert error">{err}</div> : null}
      {msg ? <div className="alert success">{msg}</div> : null}
      <form onSubmit={submit} className="card" style={{ maxWidth: 520 }}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Téléphone</label>
          <input
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Prénom</label>
          <input
            value={values.firstName}
            onChange={(e) => set('firstName', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Nom</label>
          <input
            value={values.lastName}
            onChange={(e) => set('lastName', e.target.value)}
          />
        </div>
        <h3>Changer le mot de passe</h3>
        <div className="form-group">
          <label>Mot de passe actuel</label>
          <input
            type="password"
            value={values.currentPassword}
            onChange={(e) => set('currentPassword', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Nouveau mot de passe</label>
          <input
            type="password"
            value={values.newPassword}
            onChange={(e) => set('newPassword', e.target.value)}
          />
        </div>
        <button type="submit" className="primary">
          Enregistrer
        </button>
      </form>
    </>
  );
};
