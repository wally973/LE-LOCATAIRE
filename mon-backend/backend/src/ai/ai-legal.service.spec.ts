import { AiLegalService } from './ai-legal.service';
import { classifyTripleChargeFlux } from './lia-triple-flux-charge';
import type { TicketDiagnosticContext } from '../agents/shared/diagnostic-context.service';

describe('AiLegalService — colonnes collectives (REF_EAU_SAVONNEUSE)', () => {
  const refCtx: TicketDiagnosticContext = {
    ticketId: 7,
    title: 'Humidité salon',
    description: 'eau mousseuse',
    diagnostic: null,
    sensors: {
      water_aspect: 'savonneuse/mousseuse',
      building_floor: 'R+1',
    },
    caseContext: '',
    intake: null,
    savoirVoirPhase: 'HYPOTHESES',
    tenantSupplement: '',
    tenantSocial: null,
  };

  const catalog = {
    version: 1,
    updatedAt: '2026-05-21',
    entries: [
      {
        slug: 'plumbing-colonne-bailleur',
        kind: 'FAQ',
        category: 'PLUMBING',
        title: 'Canalisation collective / colonne',
        summary: 'Réseaux collectifs : bailleur.',
        content: 'Colonnes et réseaux collectifs : bailleur.',
        responsibilityHint: 'BAILLEUR',
        keywords: ['colonne'],
        sources: [
          {
            label: 'Service Public',
            url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F31699',
            article: null,
          },
        ],
        exceptions: [],
        sortOrder: 31,
      },
      {
        slug: 'code-civil-1719-bailleur',
        kind: 'LAW',
        category: 'GENERAL',
        title: 'Code civil art. 1719',
        summary: 'Grosses réparations bailleur.',
        content: 'Art. 1719 — entretien et grosses réparations.',
        responsibilityHint: 'BAILLEUR',
        keywords: ['1719'],
        sources: [
          {
            label: 'Légifrance',
            url: 'https://www.legifrance.gouv.fr',
            article: '1719',
          },
        ],
        exceptions: [],
        sortOrder: 10,
      },
    ],
  };

  function serviceWithContext(ctx: TicketDiagnosticContext) {
    return new AiLegalService(
      {} as never,
      { fromTicket: async () => ctx } as never,
      {
        getCatalog: async () => catalog,
        search: async () => [],
      } as never,
    );
  }

  it('cite les textes sur colonnes collectives si savonneuse + R+1', async () => {
    const brief = await serviceWithContext(refCtx).assessCollectiveEvacuationForTicket(
      7,
    );

    expect(brief.applies).toBe(true);
    expect(brief.summary).toMatch(/1719|colonne|collectif/i);
    expect(brief.citations.some((c) => c.slug === 'plumbing-colonne-bailleur')).toBe(
      true,
    );
    expect(brief.citations.some((c) => c.slug === 'code-civil-1719-bailleur')).toBe(
      true,
    );
    const colonne = brief.citations.find(
      (c) => c.slug === 'plumbing-colonne-bailleur',
    )!;
    expect(colonne.sources[0]?.article ?? colonne.content).toBeTruthy();
  });

  it('ne produit pas de brief si capteurs non conformes', async () => {
    const brief = await serviceWithContext({
      ...refCtx,
      sensors: { water_aspect: 'claire', building_floor: 'RDC' },
    }).assessCollectiveEvacuationForTicket(7);

    expect(brief.applies).toBe(false);
    expect(brief.citations).toHaveLength(0);
  });
});

describe('AiLegalService — tri triple flux', () => {
  const catalog = {
    version: 1,
    updatedAt: '2026-05-21',
    entries: [
      {
        slug: 'decret-87-712-reparations-locatives',
        kind: 'DECRET',
        category: 'GENERIC',
        title: 'Décret 87-712',
        summary: 'Réparations locatives',
        content: 'Menues réparations locataire.',
        responsibilityHint: 'LOCATAIRE',
        keywords: ['87-712'],
        sources: [],
        exceptions: [],
        sortOrder: 1,
      },
      {
        slug: 'decret-87-713-charges-recuperables',
        kind: 'DECRET',
        category: 'CHARGES',
        title: 'Décret 87-713',
        summary: 'Charges récupérables',
        content: 'Liste limitative charges récupérables.',
        responsibilityHint: 'LOCATAIRE',
        keywords: ['87-713'],
        sources: [],
        exceptions: [],
        sortOrder: 2,
      },
      {
        slug: 'code-civil-1719-bailleur',
        kind: 'CODE_CIVIL',
        category: 'GENERIC',
        title: 'Art. 1719',
        summary: 'Bailleur',
        content: 'Grosses réparations bailleur.',
        responsibilityHint: 'BAILLEUR',
        keywords: ['1719'],
        sources: [],
        exceptions: [],
        sortOrder: 3,
      },
    ],
  };

  it('classifySignalementTripleFlux — VMC → RECUPERABLE', async () => {
    const svc = new AiLegalService(
      {} as never,
      {} as never,
      {
        getCatalog: async () => catalog,
        search: async () => [],
      } as never,
    );
    const r = await svc.classifySignalementTripleFlux({
      title: 'VMC',
      description: 'VMC collective en panne',
      message: '',
    });
    expect(r.flux).toBe('RECUPERABLE');
    expect(r.classification.tenantExplanationFr).toMatch(/charges récupérables/i);
    expect(r.citations.some((c) => c.slug.includes('87-713'))).toBe(true);
  });
});

describe('classifyTripleChargeFlux — AFPOLS terrain', () => {
  it('joint vs colonne', () => {
    expect(
      classifyTripleChargeFlux({
        title: 'Fuite',
        description: 'joint robinet évier',
      }).flux,
    ).toBe('LOCATIF');
    expect(
      classifyTripleChargeFlux({
        title: 'Refoulement',
        description: 'colonne eaux usées',
      }).flux,
    ).toBe('PATRIMOINE');
  });
});
