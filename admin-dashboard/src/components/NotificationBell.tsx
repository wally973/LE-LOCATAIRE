import React, { useEffect, useState } from 'react';
import {
  notificationsApi,
  type AppNotification,
} from '@services/notificationsApi';

/** Liste courte des notifications in-app */
export const NotificationBell: React.FC = () => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    notificationsApi
      .getMine()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const recent = items.slice(0, 8);

  return (
    <div className="notif-bell">
      <button
        type="button"
        className="notif-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        🔔 {items.length ? <span className="notif-badge">{items.length}</span> : null}
      </button>
      {open ? (
        <div className="notif-panel">
          {recent.length === 0 ? (
            <p className="notif-empty">Aucune notification</p>
          ) : (
            <ul>
              {recent.map((n) => (
                <li key={n.id}>
                  <strong>{n.title}</strong>
                  <span>{n.message}</span>
                  <small>{new Date(n.createdAt).toLocaleString('fr-FR')}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      <style>{`
        .notif-bell { position: relative; }
        .notif-btn {
          background: rgba(255,255,255,0.15);
          border: none;
          color: inherit;
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
        }
        .notif-badge {
          background: #e74c3c;
          border-radius: 10px;
          padding: 0 6px;
          font-size: 11px;
          margin-left: 4px;
        }
        .notif-panel {
          position: absolute;
          right: 0;
          top: 110%;
          width: 320px;
          max-height: 360px;
          overflow-y: auto;
          background: #fff;
          color: #333;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          z-index: 50;
          padding: 10px;
        }
        .notif-panel ul { list-style: none; margin: 0; padding: 0; }
        .notif-panel li {
          padding: 8px 0;
          border-bottom: 1px solid #eee;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .notif-empty { margin: 8px; color: #666; font-size: 14px; }
      `}</style>
    </div>
  );
};
