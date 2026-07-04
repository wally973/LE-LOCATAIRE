import { Injectable } from '@nestjs/common';
import { loadAfpolDocsBlock } from '../grock-afpol';
import { loadGrockDeductionDoctrine } from '../grock-deduction-ledger';
import { loadGrockSocialHousingOperationsBlock } from '../grock-social-housing-operations';
import {
  buildGrockDomainPrompt,
  inferGrockDomain,
  type GrockDomain,
} from '../grock-domain';
import { SOCIAL_HOUSING_METIER_DOCTRINE } from './social-housing-metier.prompt';
import type {
  GrockDomainContext,
  GrockDomainKnowledge,
  GrockDomainPack,
} from './domain-pack.port';

const AFPOL_DOCS_TITLE = '--- Documentation AFPOL / pathologies ---';

/**
 * Pack métier « Logement social — Guyane » (climat tropical).
 *
 * Regroupe TOUT le savoir métier de l'application derrière la porte DOMAIN_PACK :
 * inférence de domaine, brief de corps d'état, doctrine de déduction, opérations
 * logement social et documentation pathologies (AFPOL/AQC). C'est le seul module
 * à remplacer pour brancher Grock sur un autre métier.
 */
@Injectable()
export class SocialHousingGuyanePack implements GrockDomainPack {
  readonly label = 'Logement social — Guyane (climat tropical)';

  private readonly afpolCache = new Map<string, string>();

  intercomKnowledge(context: GrockDomainContext): GrockDomainKnowledge {
    const domain = inferGrockDomain({
      title: context.title,
      description: context.description,
      tenantMessage: context.tenantMessage,
      sessionMessages: context.sessionMessages,
      visualPerception: context.visualPerception,
    });

    return {
      head: [
        SOCIAL_HOUSING_METIER_DOCTRINE,
        buildGrockDomainPrompt(domain),
        loadGrockDeductionDoctrine(domain),
        loadGrockSocialHousingOperationsBlock(),
      ],
      tail: [AFPOL_DOCS_TITLE, this.afpolDocs(domain)],
    };
  }

  pathologyKnowledge(): string {
    return [AFPOL_DOCS_TITLE, this.afpolDocs()].join('\n');
  }

  /** Documentation AFPOL/AQC — mise en cache par domaine (chargement lourd). */
  private afpolDocs(domain?: GrockDomain | GrockDomain[]): string {
    const key = Array.isArray(domain) ? domain.join(',') : domain ?? 'GENERAL';
    const cached = this.afpolCache.get(key);
    if (cached) return cached;

    const docs = loadAfpolDocsBlock(domain);
    this.afpolCache.set(key, docs);
    return docs;
  }
}
