import React, { useEffect, useMemo, useState } from 'react';
import {
  addAvatarPack,
  loadAvatarRegistry,
  saveAvatarRegistry,
  type AvatarPack,
  type AvatarPackVersion,
} from '@services/avatarAdminStore';
import { setActiveAvatarPackId } from '@hooks/useLocataireAvatarSettings';

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}`;
}

/**
 * Administration des avatars 2D (packs, versions, actif).
 * Persistance locale jusqu’à API dédiée.
 */
const AdminAvatarsPage: React.FC = () => {
  const [registry, setRegistry] = useState(loadAvatarRegistry);
  const [packName, setPackName] = useState('');
  const [versionNote, setVersionNote] = useState('');
  const [semver, setSemver] = useState('1.0.0');
  const [uploadLabel, setUploadLabel] = useState('');

  useEffect(() => {
    const fn = () => setRegistry(loadAvatarRegistry());
    window.addEventListener('admin-avatar-registry-changed', fn);
    return () => window.removeEventListener('admin-avatar-registry-changed', fn);
  }, []);

  const sortedPacks = useMemo(
    () => [...registry.packs].sort((a, b) => a.name.localeCompare(b.name)),
    [registry.packs],
  );

  const createPack = () => {
    if (!packName.trim()) return;
    const id = newId('pack');
    const v: AvatarPackVersion = {
      semver,
      createdAt: new Date().toISOString(),
      note: versionNote || undefined,
      animations: [],
    };
    const pack: AvatarPack = { id, name: packName.trim(), versions: [v] };
    addAvatarPack(pack);
    setPackName('');
    setVersionNote('');
    setRegistry(loadAvatarRegistry());
  };

  const setActive = (packId: string, vers: string) => {
    const r = loadAvatarRegistry();
    r.activePackId = packId;
    r.activeVersionSemver = vers;
    saveAvatarRegistry(r);
    setActiveAvatarPackId(packId);
    setRegistry(r);
  };

  const onFakeUpload = (pack: AvatarPack) => {
    const label = uploadLabel.trim() || `sprites-${Date.now()}.zip`;
    const major = (pack.versions.length + 1).toString();
    const nextVer: AvatarPackVersion = {
      semver: `${major}.0.0`,
      createdAt: new Date().toISOString(),
      note: `Import pack : ${label}`,
      animations: [
        {
          id: 'idle',
          label: 'Neutre',
          urls: { neutral: '/avatars/placeholder.png' },
        },
      ],
    };
    const next: AvatarPack = {
      ...pack,
      versions: [nextVer, ...pack.versions],
    };
    addAvatarPack(next);
    setUploadLabel('');
    setRegistry(loadAvatarRegistry());
  };

  return (
    <div className="container">
      <h1>Avatars application</h1>
      <p style={{ color: '#64748b', maxWidth: 720 }}>
        Gestion des packs d’avatar (versionnement sémantique). Le remplacement
        des visuels et animations se fait par import de pack ; le locataire
        reçoit l’avatar actif défini ici.
      </p>

      <div className="card" style={{ marginBottom: 24, maxWidth: 520 }}>
        <h2 style={{ marginTop: 0 }}>Nouveau pack</h2>
        <div className="form-group">
          <label>Nom du pack</label>
          <input value={packName} onChange={(e) => setPackName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Version initiale (semver)</label>
          <input value={semver} onChange={(e) => setSemver(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Note de version</label>
          <input value={versionNote} onChange={(e) => setVersionNote(e.target.value)} />
        </div>
        <button type="button" className="primary" onClick={createPack}>
          Créer le pack
        </button>
      </div>

      <h2>Packs</h2>
      {sortedPacks.length === 0 ? (
        <p style={{ color: '#64748b' }}>Aucun pack pour le moment.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Versions</th>
              <th>Actif global</th>
              <th>Importer</th>
            </tr>
          </thead>
          <tbody>
            {sortedPacks.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{p.id}</div>
                </td>
                <td>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {p.versions.map((v) => (
                      <li key={v.semver}>
                        {v.semver} — {new Date(v.createdAt).toLocaleDateString('fr-FR')}
                        {v.note ? <em> ({v.note})</em> : null}
                        <button
                          type="button"
                          className="secondary"
                          style={{ marginLeft: 8 }}
                          onClick={() => setActive(p.id, v.semver)}
                        >
                          Définir actif
                        </button>
                      </li>
                    ))}
                  </ul>
                </td>
                <td>
                  {registry.activePackId === p.id
                    ? registry.activeVersionSemver ?? '—'
                    : '—'}
                </td>
                <td>
                  <input
                    placeholder="libellé fichier"
                    value={uploadLabel}
                    onChange={(e) => setUploadLabel(e.target.value)}
                    style={{ maxWidth: 140 }}
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onFakeUpload(p)}
                  >
                    Simuler upload
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminAvatarsPage;
