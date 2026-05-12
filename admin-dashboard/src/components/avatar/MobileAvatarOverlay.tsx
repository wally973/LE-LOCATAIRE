import React from 'react';
import { useAvatarCoach } from '@/context/AvatarCoachContext';
import { getActiveAvatarPackId } from '@hooks/useLocataireAvatarSettings';
import { loadAvatarRegistry } from '@services/avatarAdminStore';
import './mobile-avatar.css';

/** Avatar 2D mobile : overlay au premier plan, bulle + expressions. */
export const MobileAvatarOverlay: React.FC = () => {
  const { enabled, message, expression, pointer, coachVariant } =
    useAvatarCoach();

  if (!enabled) return null;

  const packId = getActiveAvatarPackId();
  const registry = loadAvatarRegistry();
  const pack =
    packId != null
      ? registry.packs.find((p) => p.id === packId)
      : registry.activePackId != null
        ? registry.packs.find((p) => p.id === registry.activePackId)
        : undefined;

  const title = pack?.name ?? 'Guide';

  return (
    <div
      className={`mobile-avatar-layer${
        coachVariant === 'refusal' ? ' mobile-avatar-layer--refusal' : ''
      }`}
      style={{
        position: 'fixed',
        left: pointer.x,
        top: pointer.y,
        zIndex: 10050,
      }}
    >
      <div
        className={`mobile-avatar-figure mobile-avatar-figure--${expression}`}
      >
        <div className="mobile-avatar-face" aria-hidden>
          <span className="mobile-avatar-eye" />
          <span className="mobile-avatar-eye" />
          <span className="mobile-avatar-mouth" />
        </div>
        <div className="mobile-avatar-pointer" aria-hidden />
      </div>
      {message ? (
        <div
          className={`mobile-avatar-bubble${
            coachVariant === 'refusal' ? ' mobile-avatar-bubble--refusal' : ''
          }`}
          role="status"
        >
          <strong>
            {coachVariant === 'refusal' ? 'Hors périmètre' : title}
          </strong>
          <p>{message}</p>
        </div>
      ) : null}
    </div>
  );
};
