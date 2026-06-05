import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnosticContextService } from '../agents/shared/diagnostic-context.service';
import { LegalReferencesService } from '../legal-references/legal-references.service';
import type { LegalReferenceEntryDto } from '../legal-references/legal-reference.types';
import {
  isSavonneuseR1RefoulementSensors,
  LEGAL_REFOULEMENT_EU_SLUGS,
  LEGAL_REFOULEMENT_EU_SUMMARY,
} from '../agents/shared/refoulement-eu-context';
import type { DiagnosticSensors } from '../agents/shared/lia-diagnostic-state.types';
import {
  buildArchivistBrief,
  type JarvisArchivistBrief,
} from '../agents/orchestrateur/intake/lia-jarvis-archivist-brief';
import {
  classifyTripleChargeFlux,
  tripleFluxToDisplayLabel,
  type TripleChargeFlux,
  type TripleFluxClassification,
} from './lia-triple-flux-charge';

export interface CollectiveEvacuationLegalBrief {
  ticketId: number;
  applies: boolean;
  sensors: DiagnosticSensors;
  summary: string;
  /** Textes de loi / fiches métier cités. */
  citations: LegalReferenceEntryDto[];
}

/** Résultat du tri triple flux pour un signalement (Archiviste / API). */
export interface SignalementTripleFluxResult {
  flux: TripleChargeFlux;
  fluxLabel: string;
  classification: TripleFluxClassification;
  citations: LegalReferenceEntryDto[];
  archivistBrief: JarvisArchivistBrief;
}

@Injectable()
export class AiLegalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosticContext: DiagnosticContextService,
    private readonly legalReferences: LegalReferencesService,
  ) {}

  async checkHousingCompliance(
    housingId: number,
    opts?: { ticketId?: number },
  ) {
    const housing = await this.prisma.housing.findUnique({
      where: { id: housingId },
      include: {
        landlord: {
          include: { user: true },
        },
        currentTenant: {
          include: { user: true },
        },
        documents: true,
      },
    });

    if (!housing) {
      throw new NotFoundException('Logement introuvable');
    }

    const hasContract = housing.documents.some(
      (d) => d.type === 'CONTRAT_LOCATION',
    );

    const hasInsurance = housing.documents.some(
      (d) => d.type === 'ASSURANCE_HABITATION',
    );

    const collectiveEvacuationLegal = opts?.ticketId
      ? await this.assessCollectiveEvacuationForTicket(opts.ticketId)
      : null;

    return {
      housing: {
        id: housing.id,
        address: housing.address,
        city: housing.city,
      },
      landlord: housing.landlord
        ? {
            id: housing.landlord.id,
            name: housing.landlord.name,
          }
        : null,
      tenant: housing.currentTenant
        ? {
            id: housing.currentTenant.id,
            name: `${housing.currentTenant.firstName} ${housing.currentTenant.lastName}`,
          }
        : null,
      compliance: {
        hasContract,
        hasInsurance,
      },
      collectiveEvacuationLegal,
    };
  }

  /**
   * Archiviste — contraintes légales pour le pont Jarvis (sans ticket).
   * S’appuie sur legal-references.json + lia-juridique-savoir.json + tri triple flux.
   */
  async buildSignalementLegalBrief(params: {
    title: string;
    description: string;
    message: string;
  }): Promise<JarvisArchivistBrief> {
    const triple = await this.classifySignalementTripleFlux(params);
    return triple.archivistBrief;
  }

  /**
   * Tri triple flux — LOCATIF (87-712) / RÉCUPÉRABLE (87-713) / PATRIMOINE (1719).
   * Protège l’équilibre financier locataire ↔ bailleur ; intègre cas AFPOLS.
   */
  async classifySignalementTripleFlux(params: {
    title: string;
    description: string;
    message: string;
    activeFlows?: string[];
    tradeNeeded?: string | null;
  }): Promise<SignalementTripleFluxResult> {
    const classification = classifyTripleChargeFlux(params);
    const archivistBrief = await buildArchivistBrief(this.legalReferences, params);

    const catalog = await this.legalReferences.getCatalog();
    const bySlug = new Map(catalog.entries.map((e) => [e.slug, e]));
    const slugMandatory = [
      'decret-87-712-reparations-locatives',
      'decret-87-713-charges-recuperables',
      'code-civil-1719-bailleur',
    ];
    const citations: LegalReferenceEntryDto[] = [];
    for (const slug of slugMandatory) {
      const e = bySlug.get(slug);
      if (e) citations.push(e);
    }
    for (const c of archivistBrief.citations) {
      if (!citations.some((x) => x.slug === c.slug)) citations.push(c);
    }

    return {
      flux: classification.flux,
      fluxLabel: tripleFluxToDisplayLabel(classification.flux),
      classification,
      citations,
      archivistBrief: {
        ...archivistBrief,
        chargeFlux: classification.flux,
        tenantExplanationFr: classification.tenantExplanationFr,
        tripleFluxSummary: classification.archivisteSummary,
        constraints: [
          ...archivistBrief.constraints,
          `Tri triple flux : ${tripleFluxToDisplayLabel(classification.flux)} — ${classification.afpolGrounding}`,
        ],
        summary: classification.archivisteSummary,
      },
    };
  }

  /**
   * Cite les textes sur l’entretien des colonnes / réseaux collectifs si capteurs REF.
   */
  async assessCollectiveEvacuationForTicket(
    ticketId: number,
  ): Promise<CollectiveEvacuationLegalBrief> {
    const ctx = await this.diagnosticContext.fromTicket(ticketId);
    const applies = isSavonneuseR1RefoulementSensors(ctx.sensors);

    if (!applies) {
      return {
        ticketId: ctx.ticketId,
        applies: false,
        sensors: ctx.sensors,
        summary: '',
        citations: [],
      };
    }

    const catalog = await this.legalReferences.getCatalog();
    const bySlug = new Map(catalog.entries.map((e) => [e.slug, e]));
    const citations: LegalReferenceEntryDto[] = [];
    for (const slug of LEGAL_REFOULEMENT_EU_SLUGS) {
      const entry = bySlug.get(slug);
      if (entry) citations.push(entry);
    }

    const searchHits = await this.legalReferences.search({
      query:
        'colonne collective réseau évacuation eaux usées refoulement parties communes',
      category: 'PLUMBING',
      limit: 4,
    });
    for (const hit of searchHits) {
      if (!citations.some((c) => c.slug === hit.slug)) {
        citations.push(hit);
      }
    }

    return {
      ticketId: ctx.ticketId,
      applies: true,
      sensors: ctx.sensors,
      summary: LEGAL_REFOULEMENT_EU_SUMMARY,
      citations,
    };
  }
}
