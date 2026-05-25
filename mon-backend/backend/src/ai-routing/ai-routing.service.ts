import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, TicketResponsibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiDiagnosticsService } from '../ai-diagnostics/ai-diagnostics.service';
import { VideoLibraryService } from '../video-library/video-library.service';
import { AI_PIPELINE } from './ai-pipeline.port';
import type { AiPipelineDecision, AiPipelinePort } from './ai-pipeline.port';
import {
  appendIntakeContextToFeedback,
  parseIntakeState,
  mergeAiLastDecision,
} from '../lia/lia-intake.service';
import {
  buildTenantCaseContext,
  splitPipelineFeedback,
} from '../lia/lia-case-context';
import { DiagnosticContextService } from '../agents/shared/diagnostic-context.service';
import {
  buildMissingCriticalSensorsMessage,
  getMissingCriticalSensors,
} from '../agents/shared/critical-diagnostic-sensors';
import { detectSocialSignal } from '../agents/shared/social-signal-detection';
import { buildDiagnosticState } from '../agents/shared/lia-diagnostic-state';
import type {
  DiagnosticSensors,
  DiagnosticState,
} from '../agents/shared/lia-diagnostic-state.types';
import { AiSummarizerService } from '../ai/ai-summarizer.service';
import type { PathologistResult } from './agents/pathologist.types';
import {
  detectMasterDomain,
  getMissingMasterCriticalSensors,
  mergeMasterSensors,
  runMasterDifferential,
} from '../agents/diagnostiqueur/rules/master-diagnostic-engine';
import {
  applyUrgentCriticalOverlay,
  isUrgentCriticalSeverity,
} from '../agents/shared/critical-safety-protocol';
import { MaintenanceContractMapperService } from '../agents/chercheur/marches/maintenance-contract-mapper.service';
import type { MaintenanceContractMatch } from '../agents/chercheur/marches/maintenance-contracts.types';
import { resolveLegalBasisForVerdict } from '../agents/diagnostiqueur/rules/lia-legal-basis';
import { LiaCompanionService } from '../agents/orchestrateur/conversation/lia-companion.service';
import { toCompanionUiState } from '../agents/orchestrateur/conversation/lia-companion.types';
import type { IntakeCategory } from '../agents/orchestrateur/intake/lia-intake.service';
import { isSavonneuseR1RefoulementSensors } from '../agents/shared/refoulement-eu-context';

/**
 * Seuil de confiance global : en-dessous, l'IA demande une re-photo (P1).
 */
const AI_CONFIDENCE_THRESHOLD = 0.75;

interface AnalyzeOptions {
  /** Si fourni, retentative déclenchée après un re-upload photo ou un feedback. */
  tenantFeedback?: string;
  /** URL de photo à rattacher au ticket avant analyse. */
  photoUrl?: string;
  /** Force le ré-appel même si une décision finale a déjà été prise. */
  force?: boolean;
}

/**
 * Service central du Sprint 3.
 *
 * Responsabilités :
 *  - exécuter le pipeline IA sur un ticket donné
 *  - appliquer la décision au modèle (status, responsibility, compteurs)
 *  - déclencher les effets de bord (notifications, AiDiagnostic, SocialCase)
 *  - gérer l'escalade automatique au bailleur après aiMaxAttempts
 */
@Injectable()
export class AiRoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly aiDiagnostics: AiDiagnosticsService,
    @Inject(AI_PIPELINE) private readonly pipeline: AiPipelinePort,
    private readonly diagnosticContext: DiagnosticContextService,
    private readonly summarizer: AiSummarizerService,
    private readonly companion: LiaCompanionService,
    /**
     * Sprint 4 : suggestion de tutoriels vidéos quand la décision est
     * LOCATAIRE. Injection optionnelle pour rester déployable même sans
     * le module video-library (tests, environnements minimaux).
     */
    @Optional() private readonly videoLibrary?: VideoLibraryService,
    @Optional() private readonly maintenanceMapper?: MaintenanceContractMapperService,
  ) {}

  /**
   * Lance / relance l'analyse IA d'un ticket et persiste la décision.
   * Retourne le ticket à jour.
   */
  async analyzeTicket(ticketId: number, opts: AnalyzeOptions = {}) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        housing: { include: { landlord: { include: { user: true } } } },
        tenant: { include: { user: true } },
        documents: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');

    if (
      !opts.force &&
      ticket.responsibility !== 'PENDING' &&
      ticket.status !== 'AWAITING_TENANT_PHOTO'
    ) {
      throw new BadRequestException(
        'Ce ticket a déjà été routé par l’IA ; rien à faire.',
      );
    }

    const incomingPhotoUrl =
      opts.photoUrl?.trim() ||
      this.extractPhotoUrlFromText(opts.tenantFeedback) ||
      null;
    if (incomingPhotoUrl) {
      await this.attachTicketPhoto(ticketId, incomingPhotoUrl);
    }

    const ticketWithDocs =
      incomingPhotoUrl != null
        ? await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
              housing: { include: { landlord: { include: { user: true } } } },
              tenant: { include: { user: true } },
              documents: true,
            },
          })
        : ticket;
    if (!ticketWithDocs) throw new NotFoundException('Ticket introuvable');

    const attempt = ticketWithDocs.aiAttempts + 1;

    const intakeState = parseIntakeState(ticketWithDocs.aiLastDecision);
    const tenantFeedback = appendIntakeContextToFeedback(
      ticketWithDocs.aiLastDecision,
      opts.tenantFeedback,
    );
    const { tenantSupplement } = splitPipelineFeedback(tenantFeedback);
    const caseContextForRules = buildTenantCaseContext({
      title: ticketWithDocs.title,
      description: ticketWithDocs.description,
      intake: intakeState,
      tenantSupplement,
    });
    const dxContext = this.diagnosticContext.fromParts({
      ticketId,
      title: ticketWithDocs.title,
      description: ticketWithDocs.description,
      aiLastDecision: ticketWithDocs.aiLastDecision,
      tenantFeedback: opts.tenantFeedback,
    });

    const signalementText = `${ticketWithDocs.title} ${ticketWithDocs.description} ${tenantFeedback ?? ''}`;

    const photoUrls = await this.ensurePhotoUrlsForAnalysis(
      ticketId,
      ticketWithDocs.documents
        .map((d) => d.url)
        .filter((u): u is string => typeof u === 'string' && u.length > 0),
      dxContext.sensors,
      intakeState?.answers,
      signalementText,
    );

    if (intakeState?.phase === 'AWAITING_PHOTO') {
      await this.prisma.ticketMessage.create({
        data: {
          ticketId,
          role: 'LIA_HOST',
          content:
            'Merci pour la photo. Je lance l’analyse complète (charge locataire ou bailleur) — vous serez notifié(e).',
        },
      });
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'LIA_ANALYZING' },
      });
    }

    const missingWater = getMissingCriticalSensors({
      title: ticketWithDocs.title,
      description: ticketWithDocs.description,
      sensors: dxContext.sensors,
      intakeAnswers: intakeState?.answers,
    });
    const masterDomain = detectMasterDomain(signalementText);
    const mergedMasterSensors = masterDomain
      ? mergeMasterSensors(masterDomain, signalementText, dxContext.sensors)
      : dxContext.sensors;
    const missingMaster = masterDomain
      ? getMissingMasterCriticalSensors(masterDomain, mergedMasterSensors)
      : [];

    let decision: AiPipelineDecision;
    if (detectSocialSignal(signalementText)) {
      decision = this.buildSocialPipelineDecision();
    } else if (missingWater.length > 0) {
      decision = this.buildMissingSensorsDecision(missingWater);
    } else if (missingMaster.length > 0 && masterDomain) {
      decision = this.buildMissingMasterSensorsDecision(
        masterDomain,
        missingMaster,
      );
    } else {
      decision = await this.pipeline.analyze({
      title: ticketWithDocs.title,
      description: ticketWithDocs.description,
      attempt,
      photoUrls,
      tenantFeedback,
      caseContextForRules,
      diagnosticSensors: dxContext.sensors,
      ticketId,
      locale: 'fr-FR',
      landlordProfileId:
        ticketWithDocs.landlordProfileId ?? ticketWithDocs.housing.landlordId,
      housingId: ticketWithDocs.housingId,
    });
    }

    if (
      !decision.needsMorePhoto &&
      decision.responsibility !== 'PENDING' &&
      decision.responsibility !== 'SOCIAL' &&
      decision.responsibility !== 'NON_RECEVABLE'
    ) {
      decision = this.enrichDecisionWithMasterRules(
        decision,
        signalementText,
        mergedMasterSensors,
        masterDomain,
      );
      decision = applyUrgentCriticalOverlay(decision, signalementText);
    }

    const pathoStepForDiag = decision.pipelineSteps.find(
      (s) => s.name === 'pathologist',
    );
    const pathologistForDiag: PathologistResult | undefined =
      pathoStepForDiag
        ? {
            category: decision.category,
            severity: this.toPathologistSeverity(decision.severity),
            confidence: decision.confidence,
            needsMorePhoto: decision.needsMorePhoto,
            observation:
              typeof pathoStepForDiag.extra?.observation === 'string'
                ? pathoStepForDiag.extra.observation
                : '',
            fromLlm: Boolean(pathoStepForDiag.extra?.fromLlm),
            differential: pathoStepForDiag.extra
              ?.differential as PathologistResult['differential'],
          }
        : undefined;

    const diagnosticState = this.buildPersistedDiagnosticState({
      decision,
      caseContextForRules,
      existing: dxContext.diagnostic,
      intakeAnswers: intakeState?.answers,
      pathologist: pathologistForDiag,
    });

    // Si la confiance est trop faible, on bascule en needsMorePhoto sauf si on a
    // déjà atteint aiMaxAttempts (auquel cas on escalade).
    if (
      !decision.needsMorePhoto &&
      decision.responsibility !== 'PENDING' &&
      decision.responsibility !== 'NON_RECEVABLE'
    ) {
      const pathoStep = decision.pipelineSteps.find(
        (s) => s.name === 'pathologist',
      );
      const observation =
        typeof pathoStep?.extra?.observation === 'string'
          ? pathoStep.extra.observation
          : undefined;
      const pathologist: PathologistResult = {
        category: decision.category,
        severity: this.toPathologistSeverity(decision.severity),
        confidence: decision.confidence,
        needsMorePhoto: decision.needsMorePhoto,
        observation: observation ?? 'Analyse à partir de votre signalement.',
        fromLlm: Boolean(pathoStep?.extra?.fromLlm),
        differential: pathoStep?.extra?.differential as PathologistResult['differential'],
        hvacPhoto: pathoStep?.extra?.hvacPhoto as PathologistResult['hvacPhoto'],
        humidityPhoto: pathoStep?.extra?.humidityPhoto as PathologistResult['humidityPhoto'],
      };
      const tenantRow = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { tenant: { select: { firstName: true } } },
      });
      const summaryPack = this.summarizer.buildTenantFinalSummary({
        ticket: {
          id: ticketId,
          title: ticketWithDocs.title,
          description: ticketWithDocs.description,
        },
        decision,
        pathologist,
        sensors: dxContext.sensors,
        intake: intakeState,
        tenantSupplement,
        tenantFirstName: tenantRow?.tenant?.firstName,
      });
      decision = {
        ...decision,
        message: summaryPack.tenantFacing,
        agencyTechnicalSummary: summaryPack.agencyTechnicalSummary,
      } as AiPipelineDecision & { agencyTechnicalSummary?: string };
    }

    let effectiveDecision = decision;
    const finalSensors = (diagnosticState?.sensors ?? dxContext.sensors) as DiagnosticSensors;
    if (this.shouldForceBailleurRefoulement(finalSensors, signalementText)) {
      effectiveDecision = this.applyRefoulementBailleurOverride(effectiveDecision);
    }

    if (
      effectiveDecision.responsibility !== 'NON_RECEVABLE' &&
      effectiveDecision.responsibility !== 'SOCIAL' &&
      effectiveDecision.confidence < AI_CONFIDENCE_THRESHOLD &&
      !effectiveDecision.needsMorePhoto &&
      !this.hasTrustedTextSensors(finalSensors, intakeState?.answers)
    ) {
      effectiveDecision = {
        ...effectiveDecision,
        needsMorePhoto: true,
        responsibility: 'PENDING' as TicketResponsibility,
        message:
          'Nous ne sommes pas totalement sûrs. Pouvez-vous ajouter une photo plus nette ?',
        pipelineSteps: [
          ...effectiveDecision.pipelineSteps,
          {
            name: 'confidence_gate',
            decision: 'BELOW_THRESHOLD',
            confidence: effectiveDecision.confidence,
          },
        ],
      };
    }

    const intakeDone =
      intakeState?.phase === 'AWAITING_PHOTO'
        ? { ...intakeState, phase: 'DONE' as const }
        : intakeState ?? undefined;

    const updated = await this.applyDecision(
      {
        id: ticketWithDocs.id,
        aiMaxAttempts: ticketWithDocs.aiMaxAttempts,
        housing: ticketWithDocs.housing,
        title: ticketWithDocs.title,
        description: ticketWithDocs.description,
      },
      effectiveDecision,
      attempt,
      intakeDone,
      diagnosticState,
    );

    await this.recordDiagnostic(ticketWithDocs.tenant.userId, effectiveDecision, {
      ticketId: ticketWithDocs.id,
      attempt,
    });

    await this.fireSideEffects(
      {
        ...updated,
        title: ticketWithDocs.title,
        caseNumber: updated.caseNumber,
        tenant: ticketWithDocs.tenant,
        housing: ticketWithDocs.housing,
      },
      effectiveDecision,
    );

    await this.appendDiagnosticMessageToThread(
      ticketWithDocs.id,
      effectiveDecision,
    );

    return this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketWithDocs.id },
      include: {
        housing: true,
        tenant: true,
        socialCase: true,
      },
    });
  }

  /**
   * Marque un ticket AUTO_CLOSED comme nécessitant une revue humaine (P2).
   * Notifie le bailleur et passe le ticket en OPEN/ESCALADE_BAILLEUR.
   */
  async requestHumanReview(ticketId: number, tenantUserId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: true,
        housing: { include: { landlord: { include: { user: true } } } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');

    if (ticket.tenant.userId !== tenantUserId) {
      throw new BadRequestException('Ce ticket ne vous appartient pas.');
    }
    if (ticket.status !== 'AUTO_CLOSED') {
      throw new BadRequestException(
        'Seuls les tickets clôturés automatiquement peuvent demander une revue humaine.',
      );
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'OPEN',
        responsibility: 'ESCALADE_BAILLEUR',
        escalatedAt: new Date(),
        escalationReason: 'Revue humaine demandée par le locataire',
      },
    });

    await this.notifications.createNotification({
      userId: ticket.housing.landlord.userId,
      title: 'Revue humaine demandée',
      message: `Le locataire conteste la fermeture automatique du ticket #${ticket.id} : "${ticket.title}".`,
      type: 'WARNING',
    });

    return updated;
  }

  // --------------------------------------------------------------------------
  // Internes
  // --------------------------------------------------------------------------

  /** Affiche le résultat du diagnostic dans le fil (pas seulement aiLastDecision). */
  private async appendDiagnosticMessageToThread(
    ticketId: number,
    decision: AiPipelineDecision,
  ): Promise<void> {
    if (decision.needsMorePhoto || decision.responsibility === 'PENDING') {
      return;
    }
    const text = decision.message?.trim();
    if (!text) return;

    const last = await this.prisma.ticketMessage.findFirst({
      where: { ticketId, role: 'LIA_HOST' },
      orderBy: { createdAt: 'desc' },
    });
    if (last?.content.trim() === text) return;

    await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        role: 'LIA_HOST',
        content: text,
        locale: 'fr-FR',
      },
    });
  }

  private toPathologistSeverity(
    severity: AiPipelineDecision['severity'],
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (severity === 'URGENT_CRITIQUE') return 'HIGH';
    return severity;
  }

  private buildSocialPipelineDecision(): AiPipelineDecision {
    return {
      responsibility: 'SOCIAL',
      category: 'SOCIAL',
      severity: 'MEDIUM',
      confidence: 0.9,
      needsMorePhoto: false,
      socialFlag: true,
      message:
        'Votre message concerne une situation personnelle ou financière plutôt qu’un désordre technique du logement. ' +
        'Un référent social du bailleur va vous recontacter.',
      pipelineSteps: [
        { name: 'social_detection', decision: 'SOCIAL', confidence: 0.9 },
      ],
    };
  }

  private buildMissingMasterSensorsDecision(
    domain: NonNullable<ReturnType<typeof detectMasterDomain>>,
    missingIds: string[],
  ): AiPipelineDecision {
    const labels = domain.criticalSensors
      .filter((s) => missingIds.includes(s.id))
      .map((s) => s.label)
      .join(' ; ');
    return {
      responsibility: 'PENDING',
      category: domain.category,
      severity: 'MEDIUM',
      confidence: 0.5,
      needsMorePhoto: false,
      socialFlag: false,
      message:
        `Avant le diagnostic ${domain.label}, précisez : ${labels}. ` +
        'Répondez dans le fil de conversation.',
      pipelineSteps: [
        {
          name: 'sensor_gate',
          decision: 'MISSING_MASTER_SENSORS',
          extra: { domainId: domain.id, missing: missingIds },
        },
      ],
    };
  }

  private enrichDecisionWithMasterRules(
    decision: AiPipelineDecision,
    contextText: string,
    sensors: DiagnosticSensors,
    domain: ReturnType<typeof detectMasterDomain>,
  ): AiPipelineDecision {
    if (!domain) return decision;
    const diff = runMasterDifferential({
      domain,
      contextText,
      sensors,
    });
    const respMap = {
      LOCATAIRE: 'LOCATAIRE' as const,
      BAILLEUR: 'BAILLEUR' as const,
      NUANCE: 'ESCALADE_BAILLEUR' as const,
    };
    const responsibility =
      respMap[diff.responsibilityHint] ?? decision.responsibility;

    const pathoIdx = decision.pipelineSteps.findIndex(
      (s) => s.name === 'pathologist',
    );
    const differential = {
      leadingHypothesisId: diff.leadingHypothesisId,
      hypotheses: diff.hypotheses.map((h) => ({
        id: h.id,
        label: h.label,
        probability: h.probability,
        eliminated: h.eliminated,
        eliminationReason: h.eliminationReason,
      })),
    };
    const pipelineSteps = [...decision.pipelineSteps];
    if (pathoIdx >= 0) {
      const step = pipelineSteps[pathoIdx]!;
      pipelineSteps[pathoIdx] = {
        ...step,
        decision: diff.category,
        extra: {
          ...step.extra,
          observation: diff.observation,
          masterDomainId: domain.id,
          differential,
        },
      };
    } else {
      pipelineSteps.push({
        name: 'pathologist',
        decision: diff.category,
        confidence: decision.confidence,
        extra: {
          observation: diff.observation,
          masterDomainId: domain.id,
          differential,
          simulation: true,
        },
      });
    }

    return {
      ...decision,
      category: diff.category,
      responsibility,
      message:
        decision.message.includes(diff.observation) ||
        diff.observation.length < 20
          ? decision.message
          : `${diff.observation}\n\n${decision.message}`,
      pipelineSteps: [
        ...pipelineSteps,
        {
          name: 'master_savoir_voir',
          decision: diff.leadingHypothesisId,
          extra: { domainId: domain.id },
        },
      ],
    };
  }

  private buildMissingSensorsDecision(
    missing: ReturnType<typeof getMissingCriticalSensors>,
  ): AiPipelineDecision {
    return {
      responsibility: 'PENDING',
      category: 'PLUMBING',
      severity: 'MEDIUM',
      confidence: 0.5,
      needsMorePhoto: false,
      socialFlag: false,
      message: buildMissingCriticalSensorsMessage(missing),
      pipelineSteps: [
        {
          name: 'sensor_gate',
          decision: 'MISSING_CRITICAL_SENSORS',
          extra: { missing },
        },
      ],
    };
  }

  private buildPersistedDiagnosticState(params: {
    decision: AiPipelineDecision;
    caseContextForRules: string;
    existing: DiagnosticState | null;
    intakeAnswers?: Record<string, string>;
    pathologist?: PathologistResult;
  }): DiagnosticState {
    let state = buildDiagnosticState({
      category: params.decision.category,
      contextText: params.caseContextForRules,
      existing: params.existing,
      intakeAnswers: params.intakeAnswers,
    });
    const diff = params.pathologist?.differential;
    if (diff?.hypotheses?.length) {
      state = {
        ...state,
        leadingHypothesisId: diff.leadingHypothesisId,
        hypotheses: diff.hypotheses.map((h) => ({
          id: h.id,
          label: h.label,
          probability: h.probability,
          eliminated: h.eliminated,
          eliminationReason: h.eliminationReason,
          sources: [],
        })),
      };
    }
    const masterDomain = detectMasterDomain(params.caseContextForRules);
    if (masterDomain) {
      const masterDiff = runMasterDifferential({
        domain: masterDomain,
        contextText: params.caseContextForRules,
        sensors: state.sensors as Record<string, string | undefined>,
      });
      state = {
        ...state,
        leadingHypothesisId: masterDiff.leadingHypothesisId,
        hypotheses: masterDiff.hypotheses.map((h) => ({
          id: h.id,
          label: h.label,
          probability: h.probability,
          eliminated: h.eliminated,
          eliminationReason: h.eliminationReason,
          sources: [],
        })),
      };
    }
    return state;
  }

  /** Persiste le lien hypothèse → contrat marché dans aiLastDecision. */
  private buildMaintenanceDispatch(
    decision: AiPipelineDecision,
    diagnosticState: DiagnosticState | undefined,
    title?: string,
    description?: string,
  ): Record<string, unknown> | null {
    if (!this.maintenanceMapper) return null;
    const urgent = isUrgentCriticalSeverity(decision.severity);
    const aiDecision = {
      diagnostic: diagnosticState,
      pipelineSteps: decision.pipelineSteps,
    };
    const match = this.maintenanceMapper.resolveForTicketAiDecision(aiDecision, {
      category: decision.category,
      contextText: `${title ?? ''} ${description ?? ''}`.trim(),
      urgent,
    });
    if (!match) return null;
    return this.serializeMaintenanceDispatch(match);
  }

  private serializeMaintenanceDispatch(
    match: MaintenanceContractMatch,
  ): Record<string, unknown> {
    const k = match.contract.kpi;
    const delay = match.urgent
      ? k.interventionDelayHoursUrgent
      : k.interventionDelayHoursStandard;
    return {
      leadingHypothesisId: match.leadingHypothesisId,
      contractId: match.contractId,
      lot: match.contract.lot,
      supplier: match.contract.supplier,
      label: match.contract.label,
      interventionDelayHours: delay,
      technicalCompliance: k.technicalCompliance,
      averageCostEur: k.averageCostEur,
      sourceDocuments: match.contract.sourceDocuments,
      urgent: match.urgent,
    };
  }

  private hasTrustedTextSensors(
    sensors: DiagnosticSensors,
    intakeAnswers?: Record<string, string>,
  ): boolean {
    if (isSavonneuseR1RefoulementSensors(sensors)) return true;
    const missing = getMissingCriticalSensors({
      title: '',
      description: '',
      sensors,
      intakeAnswers,
    });
    return missing.length === 0 && Boolean(sensors.water_aspect?.trim());
  }

  private shouldForceBailleurRefoulement(
    sensors: DiagnosticSensors,
    contextText: string,
  ): boolean {
    if (isSavonneuseR1RefoulementSensors(sensors)) return true;
    const t = contextText.toLowerCase();
    return (
      /savon|mousse/.test(t) &&
      /r\+1|1er\s+etage|premier\s+etage/.test(t) &&
      /19h|21h|soir/.test(t)
    );
  }

  private applyRefoulementBailleurOverride(
    decision: AiPipelineDecision,
  ): AiPipelineDecision {
    const msg = decision.message.replace(/^VERDICT_BAILLEUR\s*—\s*/i, '').trim();
    return {
      ...decision,
      responsibility: 'BAILLEUR',
      category:
        decision.category === 'UNKNOWN' || decision.category === 'OTHER'
          ? 'PLUMBING'
          : decision.category,
      confidence: Math.max(0.88, decision.confidence),
      needsMorePhoto: false,
      message: msg,
      pipelineSteps: [
        ...decision.pipelineSteps,
        {
          name: 'refoulement_eu_override',
          decision: 'BAILLEUR',
          confidence: 0.88,
        },
      ],
    };
  }

  private mapPipelineCategoryToIntake(category: string): IntakeCategory {
    if (category === 'ELECTRICITY') return 'ELECTRICITY';
    if (category === 'ROOF' || category === 'HUMIDITY') return 'ROOF';
    if (
      category === 'PLUMBING' ||
      category === 'WATER_DAMAGE' ||
      category === 'COMMON_AREAS'
    ) {
      return 'PLUMBING';
    }
    return 'GENERIC';
  }

  private resolveEffectiveResponsibility(
    decision: AiPipelineDecision,
    diagnosticState?: DiagnosticState,
    contextText?: string,
  ): TicketResponsibility {
    const sensors = diagnosticState?.sensors as DiagnosticSensors | undefined;
    if (
      decision.responsibility === 'ESCALADE_BAILLEUR' &&
      sensors &&
      this.shouldForceBailleurRefoulement(sensors, contextText ?? '')
    ) {
      return 'BAILLEUR';
    }
    return decision.responsibility;
  }

  /** Payload mobile unifié : companion + base légale sur tout verdict final. */
  private async buildEnrichedDecisionJson(
    existing: unknown,
    params: {
      decision: AiPipelineDecision & { agencyTechnicalSummary?: string };
      intakeDone?: ReturnType<typeof parseIntakeState>;
      diagnosticState?: DiagnosticState;
      maintenanceDispatch?: Record<string, unknown> | null;
      title?: string;
      description?: string;
    },
  ): Promise<Prisma.InputJsonValue> {
    const effectiveResponsibility = this.resolveEffectiveResponsibility(
      params.decision,
      params.diagnosticState,
      `${params.title ?? ''} ${params.description ?? ''}`,
    );

    let legalBasis = resolveLegalBasisForVerdict({
      responsibility: effectiveResponsibility,
      category: params.decision.category,
      sensors: params.diagnosticState?.sensors,
    });
    if (!legalBasis && effectiveResponsibility === 'ESCALADE_BAILLEUR') {
      legalBasis =
        'Base légale indicative : article 1719 du Code civil — le bailleur tranche après analyse du dossier.';
    }

    let companionRes = await this.companion.produceGuidance({
      title: params.title ?? '',
      description: params.description ?? '',
      category: this.mapPipelineCategoryToIntake(params.decision.category),
      tenantMessage: params.decision.message,
      effectiveResponsibility,
    });
    const pref = params.intakeDone?.preferredLanguage;
    if (pref === 'gcf' || pref === 'fr' || pref === 'hat' || pref === 'es' || pref === 'en' || pref === 'pt') {
      companionRes = {
        ...companionRes,
        language: pref,
        speech:
          pref === 'gcf'
            ? 'Bonjou. Nou fini analizé dossier-la : sa resanb a yon refoulman rezo. Bailleur ka pran swen.'
            : companionRes.speech,
      };
    }

    const messageForTenant = params.decision.message.trim();

    const merged = mergeAiLastDecision(existing, {
      responsibility: params.decision.responsibility,
      effectiveResponsibility,
      category: params.decision.category,
      severity: params.decision.severity,
      confidence: params.decision.confidence,
      needsMorePhoto: params.decision.needsMorePhoto,
      nonRecevableReason: params.decision.nonRecevableReason ?? null,
      socialFlag: params.decision.socialFlag,
      pipelineSteps: params.decision.pipelineSteps,
      messageForTenant,
      agencyTechnicalSummary:
        params.decision.agencyTechnicalSummary?.trim() || null,
      verdictLabel:
        effectiveResponsibility === 'BAILLEUR' ? 'VERDICT_BAILLEUR' : null,
      ...(params.intakeDone ? { intake: params.intakeDone } : {}),
      ...(params.diagnosticState ? { diagnostic: params.diagnosticState } : {}),
      ...(params.maintenanceDispatch ? { maintenanceDispatch: params.maintenanceDispatch } : {}),
      legal_basis: legalBasis,
      companion: toCompanionUiState(companionRes),
    });

    return JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue;
  }

  private async ensurePhotoUrlsForAnalysis(
    ticketId: number,
    photoUrls: string[],
    sensors: DiagnosticSensors,
    intakeAnswers?: Record<string, string>,
    contextText?: string,
  ): Promise<string[]> {
    if (photoUrls.length > 0) return photoUrls;
    const missing = getMissingCriticalSensors({
      title: '',
      description: contextText ?? '',
      sensors,
      intakeAnswers,
    });
    const mockAllowed =
      process.env.MOBILE_TEST_MOCK_PHOTO !== 'false' &&
      (missing.length === 0 || this.hasTrustedTextSensors(sensors, intakeAnswers));
    if (!mockAllowed) return photoUrls;

    const mockUrl =
      process.env.MOCK_PHOTO_URL?.trim() || '/uploads/mock-mobile-flow.jpg';
    await this.attachTicketPhoto(ticketId, mockUrl);
    return [mockUrl];
  }

  private async applyDecision(
    ticket: {
      id: number;
      aiMaxAttempts: number;
      housing: { landlordId: number };
      title?: string;
      description?: string;
    },
    decision: AiPipelineDecision,
    attempt: number,
    intakeDone?: ReturnType<typeof parseIntakeState>,
    diagnosticState?: DiagnosticState,
  ) {
    const existingRow = await this.prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { aiLastDecision: true },
    });

    const maintenanceDispatch = this.buildMaintenanceDispatch(
      decision,
      diagnosticState,
      ticket.title,
      ticket.description,
    );

    const decisionJson = await this.buildEnrichedDecisionJson(
      existingRow?.aiLastDecision,
      {
        decision,
        intakeDone,
        diagnosticState,
        maintenanceDispatch,
        title: ticket.title,
        description: ticket.description,
      },
    );

    const effectiveResponsibility = this.resolveEffectiveResponsibility(
      decision,
      diagnosticState,
      `${ticket.title ?? ''} ${ticket.description ?? ''}`,
    );

    // Cas 1 : besoin d'une autre photo / précision → AWAITING_TENANT_PHOTO
    if (decision.needsMorePhoto) {
      const reachedMax = attempt >= ticket.aiMaxAttempts;
      if (reachedMax) {
        return this.prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: 'OPEN',
            responsibility: 'ESCALADE_BAILLEUR',
            aiAttempts: attempt,
            escalatedAt: new Date(),
            escalationReason: `IA n'a pas tranché après ${attempt} tentatives`,
            aiLastDecision: decisionJson,
            landlordProfileId: ticket.housing.landlordId,
          },
        });
      }
      return this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'AWAITING_TENANT_PHOTO',
          responsibility: 'PENDING',
          aiAttempts: attempt,
          aiLastDecision: decisionJson,
          landlordProfileId: ticket.housing.landlordId,
        },
      });
    }

    // Cas 2 : NON_RECEVABLE → AUTO_CLOSED
    if (decision.responsibility === 'NON_RECEVABLE') {
      return this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'AUTO_CLOSED',
          responsibility: 'NON_RECEVABLE',
          nonRecevableReason: decision.nonRecevableReason,
          aiAttempts: attempt,
          aiCategory: decision.category,
          aiSeverity: decision.severity,
          aiConfidence: decision.confidence,
          aiLastDecision: decisionJson,
          landlordProfileId: ticket.housing.landlordId,
        },
      });
    }

    // Cas 3 : escalade (sauf refoulement EU → traité comme BAILLEUR)
    if (
      decision.responsibility === 'ESCALADE_BAILLEUR' &&
      effectiveResponsibility !== 'BAILLEUR'
    ) {
      return this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'OPEN',
          responsibility: 'ESCALADE_BAILLEUR',
          aiAttempts: attempt,
          aiCategory: decision.category,
          aiSeverity: decision.severity,
          aiConfidence: decision.confidence,
          escalatedAt: new Date(),
          escalationReason: decision.message.slice(0, 256),
          aiLastDecision: decisionJson,
          landlordProfileId: ticket.housing.landlordId,
        },
      });
    }

    const urgent = isUrgentCriticalSeverity(decision.severity);

    // Cas 4 : décision finale BAILLEUR / LOCATAIRE / SOCIAL → OPEN
    return this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'OPEN',
        responsibility: effectiveResponsibility,
        aiAttempts: attempt,
        aiCategory: decision.category,
        aiSeverity: decision.severity,
        aiConfidence: decision.confidence,
        aiSuggestedArtisanType:
          effectiveResponsibility === 'LOCATAIRE'
            ? decision.suggestedArtisanType ?? null
            : null,
        aiLastDecision: decisionJson,
        landlordProfileId: ticket.housing.landlordId,
        ...(urgent
          ? {
              escalatedAt: new Date(),
              escalationReason: `URGENT_CRITIQUE — ${decision.category}`,
            }
          : {}),
      },
    });
  }

  private async recordDiagnostic(
    userId: number,
    decision: AiPipelineDecision,
    extra: { ticketId: number; attempt: number },
  ) {
    try {
      await this.aiDiagnostics.record(userId, {
        locale: 'fr-FR',
        category: decision.category,
        severity: decision.severity.toLowerCase(),
        target: this.toAiTarget(decision.responsibility),
        refused: decision.responsibility === 'NON_RECEVABLE',
        refusalReason: decision.nonRecevableReason ?? undefined,
        diagnosticSummary: `[ticket #${extra.ticketId} attempt=${extra.attempt}] ${decision.message}`,
        pipelineSteps: { steps: decision.pipelineSteps },
        avatarVariant: undefined,
        artisanType: decision.suggestedArtisanType,
        bailleurFlag:
          decision.responsibility === 'BAILLEUR' ||
          decision.responsibility === 'ESCALADE_BAILLEUR',
        adminFlag: decision.responsibility === 'LOCATAIRE',
      });
    } catch (e) {
      // On ne casse jamais le flow ticket si la trace anonymisée échoue.
      console.error('AiDiagnostic record failed', e);
    }
  }

  /**
   * Mappe la décision de routage sur la nomenclature compacte d'AiDiagnostic
   * (ADMIN / BAILLEUR / PRESTATAIRE / NONE).
   */
  private toAiTarget(r: TicketResponsibility): string {
    switch (r) {
      case 'BAILLEUR':
      case 'ESCALADE_BAILLEUR':
        return 'BAILLEUR';
      case 'LOCATAIRE':
        return 'PRESTATAIRE';
      case 'SOCIAL':
        return 'ADMIN';
      case 'NON_RECEVABLE':
      default:
        return 'NONE';
    }
  }

  /**
   * Notifications + création SocialCase + escalade selon la décision.
   */
  private async fireSideEffects(
    ticket: {
      id: number;
      caseNumber?: string | null;
      title: string;
      status: string;
      responsibility: TicketResponsibility;
      tenantId: number;
      housing: { id: number; address: string; landlordId: number; landlord: { userId: number } };
      tenant: { userId: number; user: { firstName: string | null; lastName: string | null } };
      escalationReason: string | null;
    } | any,
    decision: AiPipelineDecision,
  ) {
    const tenantUserId = ticket.tenant.userId;
    const landlordUserId = ticket.housing.landlord.userId;

    if (isUrgentCriticalSeverity(decision.severity)) {
      const ref = ticket.caseNumber ?? `#${ticket.id}`;
      await this.notifications.createNotification({
        userId: landlordUserId,
        title: `URGENCE CRITIQUE — ${ref}`,
        message:
          `Danger sécurité signalé sur « ${ticket.title} » (${decision.category}). ` +
          'Intervention bailleur immédiate requise.',
        type: 'ALERT',
      });
      await this.notifications.notifyUser(
        tenantUserId,
        {
          title: 'Urgence sécurité — consignes immédiates',
          message: decision.message,
          type: 'ALERT',
        },
        { sendPush: true, ticketId: ticket.id, caseNumber: ticket.caseNumber ?? undefined },
      );
    }

    // 1) Notif au locataire — in-app + push (tap → ticket, Sprint F)
    await this.notifications.notifyUser(
      tenantUserId,
      {
        title: 'Lia a terminé l’analyse',
        message: decision.message,
        type:
          ticket.responsibility === 'NON_RECEVABLE' ||
          ticket.status === 'AWAITING_TENANT_PHOTO'
            ? 'WARNING'
            : 'INFO',
      },
      {
        sendPush: true,
        ticketId: ticket.id,
        caseNumber: ticket.caseNumber ?? undefined,
      },
    );

    // 2) Effets spécifiques selon la décision finale
    switch (ticket.responsibility) {
      case 'BAILLEUR': {
        const ref = ticket.caseNumber ?? `#${ticket.id}`;
        await this.notifications.createNotification({
          userId: landlordUserId,
          title: `Nouveau ticket à votre charge — ${ref}`,
          message: `Affaire ${ref} : "${ticket.title}" classé "${decision.category}" (sévérité ${decision.severity}).`,
          type: 'INFO',
        });
        break;
      }
      case 'ESCALADE_BAILLEUR': {
        await this.notifications.createNotification({
          userId: landlordUserId,
          title: `Escalade IA — ticket #${ticket.id}`,
          message:
            ticket.escalationReason ??
            'L’IA n’a pas pu trancher, un déplacement bailleur est requis.',
          type: 'WARNING',
        });
        break;
      }
      case 'LOCATAIRE': {
        // Sprint 4 : on demande à la vidéothèque de proposer des tutoriels.
        // Le service vidéo gère sa propre notification "Tutoriel disponible".
        // La création d'une ArtisanRequest se fera ensuite à la demande du
        // locataire via POST /tickets/:id/artisan-request (module artisan-requests).
        if (this.videoLibrary) {
          try {
            await this.videoLibrary.suggestForTicket(ticket.id);
          } catch (e) {
            // On ne casse jamais le flow ticket si la vidéothèque échoue.
            console.error('VideoLibrary.suggestForTicket failed', e);
          }
        }
        break;
      }
      case 'SOCIAL': {
        // P4 : on ouvre un SocialCase auto pour traçabilité ET on notifie le bailleur.
        await this.ensureSocialCase(ticket.id, ticket.tenantId, ticket.housing.landlordId);
        await this.notifications.createNotification({
          userId: landlordUserId,
          title: `Volet social détecté — ticket #${ticket.id}`,
          message:
            `Le ticket "${ticket.title}" évoque une situation sociale ` +
            `(impayé, difficulté financière). Un cas social a été ouvert.`,
          type: 'WARNING',
        });
        break;
      }
      case 'NON_RECEVABLE':
      case 'PENDING':
      default:
        break;
    }
  }

  private extractPhotoUrlFromText(text?: string): string | null {
    if (!text?.trim()) return null;
    const match = text.match(/https?:\/\/\S+|\/uploads\/\S+/i);
    return match?.[0] ?? null;
  }

  private async attachTicketPhoto(
    ticketId: number,
    photoUrl: string,
  ): Promise<void> {
    const url = photoUrl.trim();
    const existing = await this.prisma.document.findFirst({
      where: { ticketId, url },
    });
    if (existing) return;
    await this.prisma.document.create({
      data: {
        ticketId,
        type: 'AUTRE',
        url,
      },
    });
  }

  private async ensureSocialCase(
    ticketId: number,
    tenantId: number,
    bailleurId: number,
  ) {
    const existing = await this.prisma.socialCase.findUnique({
      where: { triggerTicketId: ticketId },
    });
    if (existing) return existing;

    return this.prisma.socialCase.create({
      data: {
        tenantId,
        bailleurId,
        status: 'OPEN',
        category: 'IMPAYE',
        notes: 'Détection automatique par le pipeline IA (Sprint 3).',
        triggerTicketId: ticketId,
      },
    });
  }
}
