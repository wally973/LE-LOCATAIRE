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
  language: 'fr' | 'gcf' = 'fr',
): LiaMessageUiStatus | undefined {
  if (
    responsibility === 'BAILLEUR' ||
    responsibility === 'ESCALADE_BAILLEUR'
  ) {
    return language === 'gcf'
      ? {
          kind: 'ALERT_LANDLORD',
          label: 'Alèt voye bay Bailleur-la',
          detail: 'Yon teknisyen ap kontakte aw',
          tone: 'success',
        }
      : {
          kind: 'ALERT_LANDLORD',
          label: 'Alerte transmise au bailleur',
          detail: 'Un technicien va vous recontacter',
          tone: 'success',
        };
  }
  if (responsibility === 'LOCATAIRE') {
    return language === 'gcf'
      ? {
          kind: 'LOCATAIRE_ACTION',
          label: 'Ou ka bezwen entèvansyon',
          detail: 'Gade etap swivan anba',
          tone: 'info',
        }
      : {
          kind: 'LOCATAIRE_ACTION',
          label: 'Intervention à votre charge possible',
          detail: 'Voir les étapes indiquées ci-dessous',
          tone: 'info',
        };
  }
  return undefined;
}

export function analyzingStatus(language: 'fr' | 'gcf' = 'fr'): LiaMessageUiStatus {
  return language === 'gcf'
    ? {
        kind: 'ANALYZING',
        label: 'Lia ka analize dosye a',
        detail: 'Ou ka fèmen app-la — nou ap notifye aw',
        tone: 'info',
      }
    : {
        kind: 'ANALYZING',
        label: 'Lia analyse votre dossier',
        detail: 'Vous pouvez fermer l’application — notification à venir',
        tone: 'info',
      };
}

export function landlordHandoffStatus(language: 'fr' | 'gcf' = 'fr'): LiaMessageUiStatus {
  return language === 'gcf'
    ? {
        kind: 'HANDOFF_BAILLEUR',
        label: 'Mwen ka alèt bailleur-la',
        detail: 'Yon teknisyen ap verifye evacuasyon an',
        tone: 'success',
      }
    : {
        kind: 'HANDOFF_BAILLEUR',
        label: 'Alerte transmise au bailleur',
        detail: 'Un technicien va vérifier l’évacuation',
        tone: 'success',
      };
}
