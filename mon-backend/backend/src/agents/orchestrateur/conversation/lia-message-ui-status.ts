import type { CompanionLanguage } from './lia-companion.types';

/** Statut affiché sous le dernier message Lia (synchronisé avec sa parole). */
export type LiaMessageUiStatusKind =
  | 'ANALYZING'
  | 'ALERT_LANDLORD'
  | 'HANDOFF_BAILLEUR'
  | 'LOCATAIRE_ACTION'
  | 'INFO';

export interface LiaMessageUiStatus {
  kind: LiaMessageUiStatusKind;
  label: string;
  detail?: string;
  tone: 'success' | 'info' | 'warning';
}

export function uiStatusForResponsibility(
  responsibility: string | null | undefined,
  language: CompanionLanguage = 'fr',
): LiaMessageUiStatus | undefined {
  if (
    responsibility === 'BAILLEUR' ||
    responsibility === 'ESCALADE_BAILLEUR'
  ) {
    if (language === 'gcf') {
      return {
        kind: 'ALERT_LANDLORD',
        label: 'Alèt voye bay Bailleur-la',
        detail: 'Yon teknisyen ap kontakte aw',
        tone: 'success',
      };
    }
    if (language === 'hat') {
      return {
        kind: 'ALERT_LANDLORD',
        label: 'Alèt voye bay pwopriyetè a',
        detail: 'Yon teknisyen ap kontakte ou',
        tone: 'success',
      };
    }
    if (language === 'en') {
      return {
        kind: 'ALERT_LANDLORD',
        label: 'Alert sent to landlord',
        detail: 'A technician will contact you',
        tone: 'success',
      };
    }
    if (language === 'es') {
      return {
        kind: 'ALERT_LANDLORD',
        label: 'Aviso enviado al arrendador',
        detail: 'Un técnico le contactará',
        tone: 'success',
      };
    }
    if (language === 'pt') {
      return {
        kind: 'ALERT_LANDLORD',
        label: 'Alerta enviada ao senhorio',
        detail: 'Um técnico entrará em contacto',
        tone: 'success',
      };
    }
    return {
      kind: 'ALERT_LANDLORD',
      label: 'Alerte transmise au bailleur',
      detail: 'Un technicien va vous recontacter',
      tone: 'success',
    };
  }
  if (responsibility === 'LOCATAIRE') {
    if (language === 'gcf') {
      return {
        kind: 'LOCATAIRE_ACTION',
        label: 'Ou ka bezwen entèvansyon',
        detail: 'Gade etap swivan anba',
        tone: 'info',
      };
    }
    if (language === 'en') {
      return {
        kind: 'LOCATAIRE_ACTION',
        label: 'You may need to take action',
        detail: 'See the steps below',
        tone: 'info',
      };
    }
    return {
      kind: 'LOCATAIRE_ACTION',
      label: 'Intervention à votre charge possible',
      detail: 'Voir les étapes indiquées ci-dessous',
      tone: 'info',
    };
  }
  return undefined;
}

export function analyzingStatus(
  language: CompanionLanguage = 'fr',
): LiaMessageUiStatus {
  if (language === 'gcf') {
    return {
      kind: 'ANALYZING',
      label: 'Lia ka analize dosye a',
      detail: 'Ou ka fèmen app-la — nou ap notifye aw',
      tone: 'info',
    };
  }
  if (language === 'hat') {
    return {
      kind: 'ANALYZING',
      label: 'Lia ap analize dosye ou',
      detail: 'Ou ka fèmen aplikasyon an — n ap notifye ou',
      tone: 'info',
    };
  }
  if (language === 'en') {
    return {
      kind: 'ANALYZING',
      label: 'Lia is reviewing your case',
      detail: 'You can close the app — we will notify you',
      tone: 'info',
    };
  }
  if (language === 'es') {
    return {
      kind: 'ANALYZING',
      label: 'Lia analiza su expediente',
      detail: 'Puede cerrar la aplicación — le avisaremos',
      tone: 'info',
    };
  }
  if (language === 'pt') {
    return {
      kind: 'ANALYZING',
      label: 'Lia analisa o seu caso',
      detail: 'Pode fechar a aplicação — avisaremos',
      tone: 'info',
    };
  }
  return {
    kind: 'ANALYZING',
    label: 'Lia analyse votre dossier',
    detail: 'Vous pouvez fermer l’application — notification à venir',
    tone: 'info',
  };
}

/** Dossier transmis au bailleur (fin d’intake Jarvis). */
export function dossierTransmisStatus(
  language: CompanionLanguage = 'fr',
): LiaMessageUiStatus {
  if (language === 'gcf') {
    return {
      kind: 'ALERT_LANDLORD',
      label: 'Dosye voye bay Bailleur-la',
      detail: 'Yon teknisyen ap kontakte ou',
      tone: 'success',
    };
  }
  if (language === 'en') {
    return {
      kind: 'ALERT_LANDLORD',
      label: 'Case sent to landlord',
      detail: 'A technician will contact you',
      tone: 'success',
    };
  }
  return {
    kind: 'ALERT_LANDLORD',
    label: 'Dossier transmis au bailleur',
    detail: 'Un technicien va vous recontacter',
    tone: 'success',
  };
}

export function landlordHandoffStatus(
  language: CompanionLanguage = 'fr',
): LiaMessageUiStatus {
  if (language === 'gcf') {
    return {
      kind: 'HANDOFF_BAILLEUR',
      label: 'Mwen ka alèt bailleur-la',
      detail: 'Yon teknisyen ap verifye evacuasyon an',
      tone: 'success',
    };
  }
  if (language === 'hat') {
    return {
      kind: 'HANDOFF_BAILLEUR',
      label: 'M ap alèt pwopriyetè a',
      detail: 'Yon teknisyen ap verifye evacuasyon an',
      tone: 'success',
    };
  }
  if (language === 'en') {
    return {
      kind: 'HANDOFF_BAILLEUR',
      label: 'Alert sent to landlord',
      detail: 'A technician will check the drainage',
      tone: 'success',
    };
  }
  return {
    kind: 'HANDOFF_BAILLEUR',
    label: 'Alerte transmise au bailleur',
    detail: 'Un technicien va vérifier l’évacuation',
    tone: 'success',
  };
}
