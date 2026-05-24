import { Injectable } from '@nestjs/common';
import {
  getMaintenanceContracts,
  loadMaintenanceContracts,
} from './maintenance-contracts.loader';
import type {
  MaintenanceContractEntry,
  MaintenanceContractMatch,
} from './maintenance-contracts.types';
import { parseDiagnosticState } from '../../shared/lia-diagnostic-state.types';

@Injectable()
export class MaintenanceContractMapperService {
  /**
   * Mappe une hypothèse retenue (Savoir-Voir) vers un contrat de marché sous-traité.
   */
  resolveByHypothesisId(
    leadingHypothesisId: string,
    opts?: { urgent?: boolean },
  ): MaintenanceContractMatch | null {
    if (!leadingHypothesisId?.trim()) return null;
    try {
      loadMaintenanceContracts();
    } catch {
      return null;
    }
    const catalog = getMaintenanceContracts();
    const mapping = catalog.hypothesisMappings
      .filter((m) => m.leadingHypothesisId === leadingHypothesisId)
      .sort((a, b) => a.priority - b.priority)[0];
    if (!mapping) {
      return this.resolveByHypothesisList([leadingHypothesisId], opts);
    }
    const contract = catalog.contracts.find(
      (c) => c.contractId === mapping.contractId,
    );
    if (!contract) return null;
    return {
      leadingHypothesisId,
      contractId: contract.contractId,
      contract,
      mapping,
      urgent: Boolean(opts?.urgent),
    };
  }

  /** Repli : contrat dont hypothesisIds contient l'id. */
  resolveByHypothesisList(
    hypothesisIds: string[],
    opts?: { urgent?: boolean },
  ): MaintenanceContractMatch | null {
    try {
      loadMaintenanceContracts();
    } catch {
      return null;
    }
    const catalog = getMaintenanceContracts();
    for (const id of hypothesisIds) {
      const contract = catalog.contracts.find((c) => c.hypothesisIds.includes(id));
      if (contract) {
        const mapping =
          catalog.hypothesisMappings.find(
            (m) => m.leadingHypothesisId === id && m.contractId === contract.contractId,
          ) ?? {
            leadingHypothesisId: id,
            contractId: contract.contractId,
            lot: contract.lot,
            priority: 99,
          };
        return {
          leadingHypothesisId: id,
          contractId: contract.contractId,
          contract,
          mapping,
          urgent: Boolean(opts?.urgent),
        };
      }
    }
    return null;
  }

  /** Extrait leadingHypothesisId depuis aiLastDecision (diagnostic ou pipeline). */
  extractLeadingHypothesisId(aiLastDecision: unknown): string | null {
    const diagnostic = parseDiagnosticState(aiLastDecision);
    if (diagnostic?.leadingHypothesisId) {
      return diagnostic.leadingHypothesisId;
    }
    if (!aiLastDecision || typeof aiLastDecision !== 'object') return null;
    const raw = aiLastDecision as {
      pipelineSteps?: Array<{ extra?: { differential?: { leadingHypothesisId?: string } } }>;
      maintenanceDispatch?: { leadingHypothesisId?: string };
    };
    if (raw.maintenanceDispatch?.leadingHypothesisId) {
      return raw.maintenanceDispatch.leadingHypothesisId;
    }
    for (const step of raw.pipelineSteps ?? []) {
      const id = step.extra?.differential?.leadingHypothesisId;
      if (id) return id;
    }
    return null;
  }

  resolveForTicketAiDecision(
    aiLastDecision: unknown,
    opts?: { category?: string; contextText?: string; urgent?: boolean },
  ): MaintenanceContractMatch | null {
    const leadingId = this.extractLeadingHypothesisId(aiLastDecision);
    if (leadingId) {
      const match = this.resolveByHypothesisId(leadingId, opts);
      if (match) return match;
    }
    if (opts?.contextText) {
      return this.resolveByContext(opts.contextText, opts.category, opts);
    }
    return null;
  }

  /** Repli mots-clés + catégorie ticket. */
  resolveByContext(
    contextText: string,
    category?: string,
    opts?: { urgent?: boolean },
  ): MaintenanceContractMatch | null {
    try {
      loadMaintenanceContracts();
    } catch {
      return null;
    }
    const catalog = getMaintenanceContracts();
    const t = this.norm(contextText);
    let best: MaintenanceContractEntry | null = null;
    let bestScore = 0;
    for (const contract of catalog.contracts) {
      if (category && !contract.categories.includes(category)) continue;
      let score = 0;
      for (const kw of contract.keywords) {
        if (t.includes(this.norm(kw))) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = contract;
      }
    }
    if (!best || bestScore === 0) return null;
    const hypId =
      best.hypothesisIds[0] ??
      catalog.hypothesisMappings.find((m) => m.contractId === best!.contractId)
        ?.leadingHypothesisId ??
      'unknown';
    return {
      leadingHypothesisId: hypId,
      contractId: best.contractId,
      contract: best,
      mapping: {
        leadingHypothesisId: hypId,
        contractId: best.contractId,
        lot: best.lot,
        priority: 50,
      },
      urgent: Boolean(opts?.urgent),
    };
  }

  formatBrief(match: MaintenanceContractMatch): string {
    const c = match.contract;
    const k = c.kpi;
    const delay = match.urgent
      ? k.interventionDelayHoursUrgent
      : k.interventionDelayHoursStandard;
    const bpu = c.bpuSamples
      .slice(0, 3)
      .map((l) => `${l.code} ${l.label} (${l.priceEur} €/${l.unit})`)
      .join(' ; ');
    return [
      '=== Marché d’entretien (prestataire sous contrat) ===',
      `Hypothèse retenue : ${match.leadingHypothesisId} → ContractID : ${match.contractId}`,
      `Lot : ${c.lot} | Prestataire : ${c.supplier}`,
      `Objet marché : ${c.label}`,
      `Sources : ${c.sourceDocuments.marchePdf} + ${c.sourceDocuments.bpuPdf}`,
      `Délai intervention cible : ${delay} h (${match.urgent ? 'urgence' : 'standard'})`,
      `Conformité technique : ${k.technicalCompliance}`,
      `Coût moyen lot (indicateurs) : déplacement ${k.averageCostEur.deplacement ?? '—'} €, MO ${k.averageCostEur.heureTechnicien ?? k.averageCostEur.diagnosticBiologique ?? '—'} €`,
      `Échantillon BPU : ${bpu}`,
    ].join('\n');
  }

  private norm(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }
}
