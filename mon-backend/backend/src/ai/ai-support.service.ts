import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiSupportService {
  constructor(private prisma: PrismaService) {}

  // Classe un message de support
  async classifySupportMessage(content: string) {
    // TODO: appel IA NLP
    const lowered = content.toLowerCase();

    if (lowered.includes('urgence') || lowered.includes('fuite') || lowered.includes('incendie')) {
      return { category: 'URGENCE', priority: 'HIGH' };
    }

    if (lowered.includes('facture') || lowered.includes('paiement')) {
      return { category: 'FACTURATION', priority: 'MEDIUM' };
    }

    return { category: 'GENERAL', priority: 'LOW' };
  }

  // Génère une réponse automatique simple
  async generateAutoReply(content: string) {
    const classification = await this.classifySupportMessage(content);

    if (classification.category === 'URGENCE') {
      return 'Votre demande a été classée comme urgente. Un agent va la traiter dans les plus brefs délais.';
    }

    if (classification.category === 'FACTURATION') {
      return 'Nous avons bien reçu votre demande concernant la facturation. Un agent reviendra vers vous rapidement.';
    }

    return 'Merci pour votre message. Nous l’avons bien reçu et nous reviendrons vers vous dès que possible.';
  }
}
