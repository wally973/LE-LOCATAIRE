import { Injectable } from '@nestjs/common';

@Injectable()
export class AiSummarizerService {
  constructor() {}

  /**
   * Résumé automatique d'un ticket pour bailleur
   */
  generateSummary(ticket: any, diagnostic: any, dispatch: any, priority: any) {
    const lines: string[] = [];

    lines.push(`📌 *Résumé du ticket #${ticket.id}*`);
    lines.push(`- Problème déclaré : ${ticket.title}`);
    lines.push(`- Description : ${ticket.description}`);

    if (diagnostic) {
      lines.push(`- Catégorie IA : ${diagnostic.category}`);
      lines.push(`- Gravité : ${diagnostic.severity}`);
      lines.push(`- Responsabilité probable : ${diagnostic.responsibility}`);
      if (diagnostic.risks?.length > 0) {
        lines.push(`- Risques détectés : ${diagnostic.risks.join(', ')}`);
      }
    }

    if (dispatch) {
      lines.push(`- Type d’artisan suggéré : ${dispatch.type}`);
      lines.push(`- Urgence : ${dispatch.urgency}`);
      lines.push(`- Délai estimé : ${dispatch.estimatedDelay}`);
      lines.push(`- Coût estimé : ${dispatch.estimatedCost}`);
    }

    if (priority) {
      lines.push(`- Priorité globale : ${priority.priority}`);
      lines.push(`- Score IA : ${priority.score}`);
    }

    return lines.join('\n');
  }
}
