import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { locataireApi } from '@services/locataireApi';
import { ticketsApi } from '@services/ticketsApi';
import { getErrorMessage } from '@services/apiClient';
import { TicketStatusBadge } from '@components/locataire/TicketStatusBadge';
import '@components/locataire/locataire.css';

const LocataireTicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [reply, setReply] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const reload = () => {
    if (!id) return;
    ticketsApi
      .getOne(parseInt(id, 10))
      .then((t: { title: string; description: string; status: string }) => {
        setTitle(t.title);
        setDescription(t.description);
        setStatus(t.status);
      })
      .catch((e) => setErr(getErrorMessage(e, 'Erreur')));
  };

  useEffect(() => {
    reload();
  }, [id]);

  const save = async () => {
    if (!id) return;
    try {
      await ticketsApi.update(parseInt(id, 10), { title, description });
      setMsg('Modifications enregistrées.');
    } catch (e) {
      setErr(getErrorMessage(e, 'Sauvegarde impossible'));
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setErr('');
      await locataireApi.replyToTicket(parseInt(id, 10), reply);
      setReply('');
      setMsg('Réponse ajoutée.');
      reload();
    } catch (ex) {
      setErr(getErrorMessage(ex, 'Envoi impossible'));
    }
  };

  return (
    <div className="container">
      <button
        type="button"
        className="secondary"
        onClick={() => navigate('/locataire/tickets')}
      >
        ← Retour
      </button>
      <h1>Ticket #{id}</h1>
      {err ? <div className="alert error">{err}</div> : null}
      {msg ? <div className="alert success">{msg}</div> : null}

      <p>
        Statut : <TicketStatusBadge status={status} /> (mis à jour par le
        bailleur)
      </p>

      <div className="form-group">
        <label>Titre</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Description / fil du ticket</label>
        <textarea
          rows={8}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <button type="button" className="primary" onClick={() => void save()}>
        Enregistrer les modifications
      </button>

      <form onSubmit={sendReply} className="card" style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Répondre</h2>
        <p style={{ fontSize: 14, color: '#64748b' }}>
          Ajoute un message dans le fil visible par le bailleur.
        </p>
        <div className="form-group">
          <label>Votre message</label>
          <textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
        </div>
        <button type="submit" className="primary">
          Envoyer la réponse
        </button>
      </form>
    </div>
  );
};

export default LocataireTicketDetailPage;
