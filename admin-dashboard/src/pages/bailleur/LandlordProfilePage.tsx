import React, { useEffect, useState } from 'react';
import { bailleurApi } from '@services/bailleurApi';
import { landlordApi } from '@services/landlordApi';
import { getErrorMessage } from '@services/apiClient';

function splitName(full: string | undefined) {
  if (!full?.trim()) return { first: '', last: '' };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

const LandlordProfilePage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    landlordApi
      .getProfile()
      .then((u: { email?: string | null; phone?: string; landlord?: { name?: string } }) => {
        setEmail(u.email ?? '');
        setPhone(u.phone ?? '');
        const { first, last } = splitName(u.landlord?.name);
        setFirstName(first);
        setLastName(last);
      })
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErr('');
      await bailleurApi.updateBailleurProfile({
        email,
        phone,
        firstName,
        lastName,
      });
      setMsg('Profil mis à jour');
    } catch (ex) {
      setErr(getErrorMessage(ex, 'Sauvegarde impossible'));
    }
  };

  return (
    <div className="container">
      <h1>Mon profil</h1>
      {err ? <div className="alert error">{err}</div> : null}
      {msg ? <div className="alert success">{msg}</div> : null}
      <form onSubmit={save} className="card" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Téléphone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Prénom (nom affiché bailleur)</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Nom</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <button type="submit" className="primary">
          Enregistrer
        </button>
      </form>
    </div>
  );
};

export default LandlordProfilePage;
