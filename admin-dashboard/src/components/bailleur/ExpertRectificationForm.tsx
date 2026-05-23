import React, { useMemo, useState } from 'react';
import { proBriefingApi } from '@services/proBriefingApi';
import { getErrorMessage } from '@services/apiClient';
import type { TicketResponsibilityUi } from '@/types/bailleur';
import '@components/bailleur/bailleur.css';

type SpecialHandling = 'STRUCTURAL_INFILTRATION' | 'VULNERABLE_TENANT';

const RESPONSIBILITY_OPTIONS: Array<{
  value: TicketResponsibilityUi;
  label: string;
}> = [
  { value: 'BAILLEUR', label: 'Charge bailleur' },
  { value: 'LOCATAIRE', label: 'Charge locataire' },
  { value: 'SOCIAL', label: 'Social' },
  { value: 'ESCALADE_BAILLEUR', label: 'Escalade bailleur' },
  { value: 'NON_RECEVABLE', label: 'Non recevable' },
];

const SPECIAL_LABELS: Record<SpecialHandling, string> = {
  STRUCTURAL_INFILTRATION: 'Infiltration / structure du bâtiment',
  VULNERABLE_TENANT: 'Locataire âgé ou en situation de handicap',
};

interface ExpertRectificationFormProps {
  ticketId: number;
  currentResponsibility?: TicketResponsibilityUi | string;
  onRectified: () => void;
}

function defaultResponsibility(
  current?: TicketResponsibilityUi | string,
): TicketResponsibilityUi {
  const v = String(current ?? 'PENDING') as TicketResponsibilityUi;
  if (v === 'PENDING' || v === 'LOCATAIRE') return 'BAILLEUR';
  if (RESPONSIBILITY_OPTIONS.some((o) => o.value === v)) return v;
  return 'BAILLEUR';
}

export const ExpertRectificationForm: React.FC<ExpertRectificationFormProps> = ({
  ticketId,
  currentResponsibility,
  onRectified,
}) => {
  const initialResp = useMemo(
    () => defaultResponsibility(currentResponsibility),
    [currentResponsibility],
  );

  const [correctedDiagnosis, setCorrectedDiagnosis] = useState('');
  const [reason, setReason] = useState('');
  const [modelHint, setModelHint] = useState('');
  const [responsibility, setResponsibility] =
    useState<TicketResponsibilityUi>(initialResp);
  const [structural, setStructural] = useState(false);
  const [vulnerable, setVulnerable] = useState(false);
  const [vulnerableDetail, setVulnerableDetail] = useState('');
  const [takeCharge, setTakeCharge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  const applyStructuralPreset = () => {
    setStructural(true);
    setResponsibility('BAILLEUR');
    setModelHint('Toiture / structure / façade');
    setCorrectedDiagnosis(
      'Infiltration active avec impact possible sur la structure du bâtiment (dalle, ossature ou étanchéité). Intervention bailleur en urgence relative.',
    );
    setReason(
      'Constat terrain : dégâts structurels ou risque avéré — hors entretien courant locataire.',
    );
    setTakeCharge(true);
  };

  const applyVulnerablePreset = () => {
    setVulnerable(true);
    setResponsibility('BAILLEUR');
    setReason(
      'Locataire âgé ou en situation de handicap — prise en charge prioritaire et suivi adapté.',
    );
    if (!correctedDiagnosis.trim()) {
      setCorrectedDiagnosis(
        'Demande traitée en priorité compte tenu de la vulnérabilité du locataire.',
      );
    }
    setTakeCharge(true);
  };

  const toggleHandling = (
    key: SpecialHandling,
    checked: boolean,
    setter: (v: boolean) => void,
  ) => {
    setter(checked);
    if (key === 'STRUCTURAL_INFILTRATION' && checked) {
      setResponsibility('BAILLEUR');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setSuccess('');

    const specialHandling: SpecialHandling[] = [];
    if (structural) specialHandling.push('STRUCTURAL_INFILTRATION');
    if (vulnerable) specialHandling.push('VULNERABLE_TENANT');

    try {
      const res = await proBriefingApi.rectify(ticketId, {
        correctedDiagnosis,
        reason,
        modelHint: modelHint.trim() || undefined,
        responsibility,
        specialHandling: specialHandling.length ? specialHandling : undefined,
        vulnerableDetail: vulnerable
          ? vulnerableDetail.trim() || undefined
          : undefined,
        takeCharge,
      });
      setSuccess(res.messageForTenant);
      setCorrectedDiagnosis('');
      setReason('');
      setModelHint('');
      setStructural(false);
      setVulnerable(false);
      setVulnerableDetail('');
      setResponsibility(initialResp);
      setTakeCharge(true);
      onRectified();
    } catch (ex) {
      setErr(getErrorMessage(ex, 'Rectification impossible'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card expert-rectify" style={{ marginTop: 20 }}>
      <h2 style={{ marginTop: 0 }}>Rectification expert</h2>
      <p className="muted" style={{ fontSize: 14 }}>
        Corrigez le diagnostic IA, fixez la charge et signalez les cas sensibles.
        Lia s’alignera sur votre constat et le fil locataire sera mis à jour.
      </p>

      <div className="expert-rectify__presets">
        <button
          type="button"
          className="secondary expert-rectify__preset"
          onClick={applyStructuralPreset}
        >
          Infiltration / structure
        </button>
        <button
          type="button"
          className="secondary expert-rectify__preset"
          onClick={applyVulnerablePreset}
        >
          Personne vulnérable
        </button>
      </div>

      {err ? <div className="alert error">{err}</div> : null}
      {success ? (
        <div className="alert success">
          <strong>Diagnostic validé par l’expert.</strong>
          <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{success}</p>
        </div>
      ) : null}

      <form onSubmit={(e) => void submit(e)}>
        <div className="form-group">
          <label htmlFor="corr-resp">Charge retenue</label>
          <select
            id="corr-resp"
            value={responsibility}
            onChange={(e) =>
              setResponsibility(e.target.value as TicketResponsibilityUi)
            }
            required
          >
            {RESPONSIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group expert-rectify__flags">
          <span className="expert-rectify__flags-label">Cas sensibles</span>
          <label className="expert-rectify__check">
            <input
              type="checkbox"
              checked={structural}
              onChange={(e) =>
                toggleHandling(
                  'STRUCTURAL_INFILTRATION',
                  e.target.checked,
                  setStructural,
                )
              }
            />
            {SPECIAL_LABELS.STRUCTURAL_INFILTRATION}
          </label>
          <label className="expert-rectify__check">
            <input
              type="checkbox"
              checked={vulnerable}
              onChange={(e) =>
                toggleHandling(
                  'VULNERABLE_TENANT',
                  e.target.checked,
                  setVulnerable,
                )
              }
            />
            {SPECIAL_LABELS.VULNERABLE_TENANT}
          </label>
        </div>

        {vulnerable ? (
          <div className="form-group">
            <label htmlFor="corr-vuln">Précisions vulnérabilité (optionnel)</label>
            <textarea
              id="corr-vuln"
              rows={2}
              value={vulnerableDetail}
              onChange={(e) => setVulnerableDetail(e.target.value)}
              placeholder="Ex. : locataire de 82 ans, mobilité réduite, pas d’aidant à proximité…"
            />
          </div>
        ) : null}

        <div className="form-group">
          <label htmlFor="corr-diag">Diagnostic terrain retenu</label>
          <textarea
            id="corr-diag"
            rows={3}
            value={correctedDiagnosis}
            onChange={(e) => setCorrectedDiagnosis(e.target.value)}
            placeholder="Ex. : infiltration au plafond avec traces sur dalle portée."
            required
            minLength={10}
          />
        </div>
        <div className="form-group">
          <label htmlFor="corr-reason">Motif de la correction</label>
          <textarea
            id="corr-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : constat sur place incompatible avec la lecture IA."
            required
            minLength={3}
          />
        </div>
        <div className="form-group">
          <label htmlFor="corr-model">Équipement / zone (optionnel)</label>
          <input
            id="corr-model"
            type="text"
            value={modelHint}
            onChange={(e) => setModelHint(e.target.value)}
            placeholder="Ex. : toiture, dalle, façade, hotte…"
          />
        </div>

        <label className="expert-rectify__check expert-rectify__take-charge">
          <input
            type="checkbox"
            checked={takeCharge}
            onChange={(e) => setTakeCharge(e.target.checked)}
          />
          Je prends en charge cette affaire (passe en cours de traitement)
        </label>

        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Valider la rectification expert'}
        </button>
      </form>
    </div>
  );
};

export default ExpertRectificationForm;
