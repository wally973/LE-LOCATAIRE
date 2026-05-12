import { Injectable } from '@nestjs/common';

@Injectable()
export class AiSocialService {
  constructor() {}

  /**
   * Analyse le risque social à partir du texte
   * Retourne un niveau de risque + catégorie + note
   */
  async analyzeSocialRisk(description: string) {
    if (!description || description.trim().length === 0) {
      return {
        risk: 'LOW',
        category: 'AUTRE',
        note: 'Aucun élément social détecté.',
      };
    }

    const text = description.toLowerCase();

    // Risque faible par défaut
    let risk = 'LOW';
    let category = 'AUTRE';
    let note = 'Aucun risque social particulier détecté.';

    // Détection simple (MVP)
    if (text.includes('impayé') || text.includes('loyer') || text.includes('payer')) {
      risk = 'MEDIUM';
      category = 'IMPAYE';
      note = 'Possibilité de difficulté financière.';
    }

    if (text.includes('apl') || text.includes('caf') || text.includes('allocation')) {
      risk = 'MEDIUM';
      category = 'APL';
      note = 'Demande ou problème lié aux aides sociales.';
    }

    if (
      text.includes('violence') ||
      text.includes('danger') ||
      text.includes('menace') ||
      text.includes('urgence sociale')
    ) {
      risk = 'HIGH';
      category = 'SOCIAL';
      note = 'Risque social élevé détecté.';
    }

    return {
      risk,
      category,
      note,
    };
  }
}
