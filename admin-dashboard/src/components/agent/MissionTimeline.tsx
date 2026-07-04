import React from 'react';
import type { LandlordInfoEvent } from '@/types/bailleur';
import type { TicketMessageRow } from '@/types/agent';

const ROLE_LABEL: Record<string, string> = {
  TENANT: 'Locataire',
  LIA_HOST: 'Lia',
  LIA_SYSTEM: 'Système',
};

interface MissionTimelineProps {
  messages: TicketMessageRow[];
  infoEvents?: LandlordInfoEvent[];
}

export const MissionTimeline: React.FC<MissionTimelineProps> = ({
  messages,
  infoEvents = [],
}) => {
  const events = [
    ...infoEvents.map((e) => ({
      key: `info-${e.at}-${e.kind}`,
      at: e.at,
      actor: 'Dossier',
      content: `${e.label}${e.detail ? ` — ${e.detail}` : ''}`,
    })),
    ...messages.map((m) => ({
      key: `msg-${m.id}`,
      at: m.createdAt,
      actor: ROLE_LABEL[m.role] ?? m.role,
      content: m.content,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (events.length === 0) {
    return <p className="muted">Aucune étape enregistrée pour l’instant.</p>;
  }

  return (
    <ol className="agent-timeline">
      {events.map((e) => (
        <li key={e.key} className="agent-timeline__item">
          <div className="agent-timeline__meta">
            <span className="agent-timeline__actor">{e.actor}</span>
            <time dateTime={e.at}>
              {new Date(e.at).toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
          <p className="agent-timeline__content">{e.content}</p>
        </li>
      ))}
    </ol>
  );
};
