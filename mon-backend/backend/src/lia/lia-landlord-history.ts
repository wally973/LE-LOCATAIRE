/**
 * Événements informatifs pour la recherche dossier bailleur (pas d’action technicien).
 */

import { isSinkBlockageScenario } from './lia-tenant-explanation';
import { parseIntakeState, buildIntakeSummary } from './lia-intake.service';
import { parseExpertRectification } from './lia-expert-rectification.types';

export type LandlordInfoEventKind =
  | 'DIAGNOSTIC_LOCATAIRE'
  | 'ARTISAN_DECLINED'
  | 'ARTISAN_REQUESTED'
  | 'EXPERT_RECTIFIED';

export interface LandlordInfoEvent {
  at: string;
  kind: LandlordInfoEventKind;
  label: string;
  detail: string;
}

export interface LandlordHistoryNoteStored {
  at: string;
  kind: LandlordInfoEventKind;
  label: string;
  detail: string;
}

function asNotes(raw: unknown): LandlordInfoEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n) => n && typeof n === 'object')
    .map((n) => {
      const o = n as LandlordHistoryNoteStored;
      return {
        at: String(o.at ?? new Date().toISOString()),
        kind: o.kind,
        label: String(o.label ?? ''),
        detail: String(o.detail ?? ''),
      };
    })
    .filter((n) => n.label.length > 0);
}

function responsibilityLabel(code: string | null | undefined): string {
  switch (code) {
    case 'LOCATAIRE':
      return 'Charge locataire';
    case 'BAILLEUR':
    case 'ESCALADE_BAILLEUR':
      return 'Charge bailleur';
    default:
      return code ?? '—';
  }
}

function buildDiagnosticDetail(
  title: string,
  aiLastDecision: unknown,
): string {
  const intake = parseIntakeState(aiLastDecision);
  const context = intake
    ? `${title}\n${buildIntakeSummary(intake)}`
    : title;
  if (isSinkBlockageScenario(context)) {
    return (
      'Lavabo OK, évier mal drainé — orientation bouchon / siphon sous l’évier. ' +
      'Entretien locatif (locataire) : pas d’intervention bailleur sur ce point.'
    );
  }
  return (
    'Intervention classée entretien locatif / menues réparations à la charge du locataire.'
  );
}

/** Note enregistrée au refus d’artisan (historique bailleur). */
export function buildArtisanDeclinedLandlordNote(params: {
  responsibility: string | null;
  title: string;
  aiLastDecision: unknown;
}): LandlordHistoryNoteStored {
  const at = new Date().toISOString();
  const charge = responsibilityLabel(params.responsibility);
  const diag = buildDiagnosticDetail(params.title, params.aiLastDecision);
  return {
    at,
    kind: 'ARTISAN_DECLINED',
    label: 'Pas de demande d’artisan — refus locataire',
    detail:
      `${charge}. ${diag} ` +
      'Le locataire a refusé une mise en relation plombier : aucun devis ni commande d’intervention via l’application. ' +
      'Rien à transmettre au planning technicien pour cet artisan.',
  };
}

export function buildLandlordInfoEvents(params: {
  title: string;
  responsibility: string | null;
  aiLastDecision: unknown;
  updatedAt: Date;
  hasArtisanRequest: boolean;
  artisanRequestedAt?: Date | null;
}): LandlordInfoEvent[] {
  const ai = params.aiLastDecision as Record<string, unknown> | null;
  const events: LandlordInfoEvent[] = [...asNotes(ai?.landlordHistoryNotes)];

  const hasKind = (k: LandlordInfoEventKind) => events.some((e) => e.kind === k);

  if (
    params.responsibility === 'LOCATAIRE' &&
    !hasKind('DIAGNOSTIC_LOCATAIRE')
  ) {
    events.push({
      at: params.updatedAt.toISOString(),
      kind: 'DIAGNOSTIC_LOCATAIRE',
      label: 'Diagnostic IA — charge locataire',
      detail: buildDiagnosticDetail(params.title, params.aiLastDecision),
    });
  }

  if (ai?.artisanDeclined === true && !hasKind('ARTISAN_DECLINED')) {
    events.push({
      at: String(ai.artisanDeclinedAt ?? params.updatedAt.toISOString()),
      kind: 'ARTISAN_DECLINED',
      label: 'Pas de demande d’artisan',
      detail:
        'Le locataire a refusé la mise en relation. Aucun devis ni intervention commandée via l’application.',
    });
  }

  const expert = parseExpertRectification(ai);
  if (expert && !hasKind('EXPERT_RECTIFIED')) {
    events.push({
      at: expert.correctedAt,
      kind: 'EXPERT_RECTIFIED',
      label: 'Diagnostic validé par l’expert',
      detail:
        `${expert.expertDisplayName} : ${expert.correctedDiagnosis}` +
        (expert.reason ? ` — Motif : ${expert.reason}` : ''),
    });
  }

  if (params.hasArtisanRequest && !hasKind('ARTISAN_REQUESTED')) {
    events.push({
      at: (params.artisanRequestedAt ?? params.updatedAt).toISOString(),
      kind: 'ARTISAN_REQUESTED',
      label: 'Demande d’artisan ouverte',
      detail:
        'Le locataire a demandé un artisan partenaire — suivi dans le module demandes d’artisan.',
    });
  }

  return events.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
