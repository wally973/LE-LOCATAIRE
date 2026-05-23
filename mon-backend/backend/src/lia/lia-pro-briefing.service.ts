import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BailleurScopeService } from '../auth/scope/bailleur-scope.service';
import { LiaSharedStateService } from './lia-shared-state.service';
import { LiaResearchService } from './lia-research.service';
import { LiaHostService } from './lia-host.service';
import {
  buildIntakeSummary,
  parseIntakeState,
} from './lia-intake.service';
import { parseCompanionState } from './lia-companion.types';
import { parseExpertRectification } from './lia-expert-rectification.types';
import type {
  ProBriefing,
  ProBriefingAskResult,
  ProBriefingCritical,
  ProBriefingResearch,
} from './lia-pro-briefing.types';

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: 'Plomberie',
  ELECTRICITY: 'Électricité',
  ROOF: 'Toiture',
  GENERIC: 'Général',
  HUMIDITY: 'Humidité',
  HEATING: 'Chauffage',
  LOCKSMITH: 'Serrurerie',
  CARPENTRY: 'Menuiserie',
  ROOFING: 'Toiture',
  SANITARY: 'Sanitaires',
  OTHER: 'Autre',
};

/** Équipements / zones détectables dans le texte locataire. */
const EQUIPMENT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /chauffe[- ]?eau/i, label: 'Chauffe-eau' },
  { pattern: /ballon d['']eau/i, label: 'Ballon d’eau chaude' },
  { pattern: /\bwc\b|toilettes?|cuvette/i, label: 'WC / toilettes' },
  { pattern: /lavabo|évier|evier|siphon/i, label: 'Lavabo / évier' },
  { pattern: /robinet|mitigeur/i, label: 'Robinet / mitigeur' },
  { pattern: /douche|baignoire/i, label: 'Douche / baignoire' },
  { pattern: /tableau électrique|disjoncteur|compteur|prise/i, label: 'Installation électrique' },
  { pattern: /chaudi[èe]re/i, label: 'Chaudière' },
  { pattern: /radiateur|chauffage/i, label: 'Chauffage / radiateur' },
  { pattern: /toiture|toit|goutti[èe]re|infiltration/i, label: 'Toiture / étanchéité' },
  { pattern: /vmc|ventilation/i, label: 'VMC / ventilation' },
  { pattern: /serrure|porte|clef|clé/i, label: 'Serrurerie / porte' },
];

/**
 * Pro Briefing — synthèse technique depuis le SharedState + Q&A technicien.
 */
@Injectable()
export class LiaProBriefingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sharedState: LiaSharedStateService,
    private readonly research: LiaResearchService,
    private readonly host: LiaHostService,
    private readonly scopeService: BailleurScopeService,
  ) {}

  async generate(ticketId: number, userId: number, role: string): Promise<ProBriefing> {
    const ticket = await this.assertCanAccess(ticketId, userId, role);
    const state = await this.sharedState.load(ticketId, ticket.tenant.userId);
    const internalBrief = await this.research.buildInternalBrief(ticketId);
    const expert = state.expertRectification;

    const critical = this.extractCritical(ticket, state.intake, expert);
    const research = this.extractResearch(
      ticket,
      state.intake,
      internalBrief,
    );

    const { narrative, fromLlm } = await this.buildNarrative(
      ticket,
      critical,
      research,
      state.tenantFirstName,
      expert,
    );

    const ai = ticket.aiLastDecision as { messageForTenant?: string } | null;

    return {
      ticketId,
      caseNumber: ticket.caseNumber,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      housingAddress: ticket.housing?.address ?? null,
      generatedAt: new Date().toISOString(),
      narrativeSummary: narrative,
      critical,
      research,
      diagnosticMessage: ai?.messageForTenant ?? null,
      diagnosticAuthority: state.diagnosticAuthority,
      expertCorrection: expert
        ? {
            expertName: expert.expertDisplayName,
            correctedDiagnosis: expert.correctedDiagnosis,
            reason: expert.reason,
            modelHint: expert.modelHint ?? null,
            correctedAt: expert.correctedAt,
            responsibility: expert.responsibilityOverride ?? null,
            specialHandling: expert.specialHandling ?? [],
            vulnerableDetail: expert.vulnerableDetail ?? null,
            takeCharge: expert.takeCharge ?? false,
          }
        : null,
      fromLlm,
    };
  }

  async ask(
    ticketId: number,
    userId: number,
    role: string,
    question: string,
  ): Promise<ProBriefingAskResult> {
    await this.assertCanAccess(ticketId, userId, role);
    const briefing = await this.generate(ticketId, userId, role);

    const messages = await this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      take: 30,
      select: { role: true, content: true },
    });

    const threadExcerpt = messages
      .slice(-12)
      .map((m) => `[${m.role}] ${m.content.slice(0, 400)}`)
      .join('\n');

    const expertBlock = briefing.expertCorrection
      ? [
          '=== VALIDÉ PAR EXPERT (source de vérité — ne pas contredire) ===',
          `${briefing.expertCorrection.expertName} : ${briefing.expertCorrection.correctedDiagnosis}`,
          `Motif : ${briefing.expertCorrection.reason}`,
          briefing.expertCorrection.modelHint
            ? `Équipement : ${briefing.expertCorrection.modelHint}`
            : '',
        ].filter(Boolean)
      : [];

    const contextBlock = [
      ...expertBlock,
      `Affaire ${briefing.caseNumber ?? ticketId} — ${briefing.title}`,
      `Autorité diagnostic : ${briefing.diagnosticAuthority}`,
      `Statut : ${briefing.status} | Charge : ${briefing.critical.responsibility ?? 'en cours'}`,
      `Équipement/zone : ${briefing.critical.model ?? 'non précisé'}`,
      `Symptômes : ${briefing.critical.symptoms.join(' ; ') || '—'}`,
      briefing.research.intakeSummary,
      briefing.research.searchTrigger
        ? `Recherche : ${briefing.research.searchTrigger}`
        : '',
      briefing.research.juristRationale
        ? `Motif juridique : ${briefing.research.juristRationale}`
        : '',
      briefing.diagnosticMessage
        ? `Message diagnostic Lia : ${briefing.diagnosticMessage}`
        : '',
      threadExcerpt ? `Fil récent :\n${threadExcerpt}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const systemPrompt = [
      'Tu es un assistant technique pour techniciens et référents bailleur (logement social, Guyane).',
      'Réponds à la question en te basant UNIQUEMENT sur le contexte dossier fourni.',
      'Si une rectification expert est présente, elle ÉCRASE le diagnostic IA : ne la conteste jamais, reste humble (assistante du pro).',
      'Si l’information manque, dis-le clairement et indique ce qu’il faudrait vérifier sur place.',
      'Style : concis, professionnel, orienté intervention (2 à 6 phrases).',
      'Ne donne pas de conseil juridique définitif — cite les faits du dossier.',
    ].join('\n');

    const userPrompt = [
      '=== Contexte dossier ===',
      contextBlock,
      '',
      '=== Question technicien ===',
      question.trim(),
    ].join('\n');

    const llm = await this.host.chatStructured(systemPrompt, userPrompt, 450);
    if (llm) {
      return {
        question: question.trim(),
        answer: llm,
        fromLlm: true,
        contextHint: `Briefing ${briefing.caseNumber ?? `#${ticketId}`} — ${briefing.critical.categoryLabel}`,
      };
    }

    return {
      question: question.trim(),
      answer: this.fallbackAnswer(briefing, question.trim()),
      fromLlm: false,
      contextHint: `Briefing ${briefing.caseNumber ?? `#${ticketId}`} (mode hors-ligne)`,
    };
  }

  private async assertCanAccess(ticketId: number, userId: number, role: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: true,
        housing: { include: { landlord: true } },
        documents: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');

    if (role === 'ADMIN') return ticket;

    if (role === 'PRESTATAIRE') {
      const slot = await this.prisma.planningSlot.findFirst({
        where: { ticketId, artisanId: userId },
      });
      if (!slot) {
        throw new ForbiddenException(
          'Ce ticket ne vous est pas assigné en intervention.',
        );
      }
      return ticket;
    }

    if (role === 'BAILLEUR' || role === 'AGENT') {
      const scope = await this.scopeService.resolve({ id: userId, role });
      if (!scope.landlordProfileId) {
        throw new ForbiddenException('Profil bailleur introuvable');
      }
      const landlordId = ticket.landlordProfileId ?? ticket.housing.landlordId;
      if (landlordId !== scope.landlordProfileId) {
        throw new ForbiddenException('Ce ticket n’appartient pas à votre organisme');
      }
      if (role === 'AGENT' && scope.agenceId != null) {
        const housingAgence = await this.prisma.housing.findUnique({
          where: { id: ticket.housingId },
          select: { agenceId: true },
        });
        if (housingAgence?.agenceId !== scope.agenceId) {
          throw new ForbiddenException('Ticket hors de votre secteur');
        }
      }
      return ticket;
    }

    throw new ForbiddenException('Accès Pro Briefing réservé aux techniciens et référents');
  }

  private extractCritical(
    ticket: {
      title: string;
      description: string;
      responsibility: string;
      aiCategory: string | null;
      aiSeverity: string | null;
      aiConfidence: number | null;
      aiSuggestedArtisanType: string | null;
      documents: { url: string | null }[];
      aiLastDecision: unknown;
    },
    intake: ReturnType<typeof parseIntakeState>,
    expert: ReturnType<typeof parseExpertRectification>,
  ): ProBriefingCritical {
    const category =
      ticket.aiCategory ?? intake?.category ?? 'GENERIC';
    const companion = parseCompanionState(ticket.aiLastDecision);
    const text = `${ticket.title} ${ticket.description}`;
    let symptoms = this.extractSymptoms(text, intake);
    if (expert) {
      symptoms = [expert.correctedDiagnosis, ...symptoms].slice(0, 5);
    }

    return {
      model:
        expert?.modelHint?.trim() ||
        this.detectEquipment(text, intake?.category ?? null),
      symptoms,
      category,
      categoryLabel: CATEGORY_LABELS[category] ?? category.replace(/_/g, ' '),
      severity: ticket.aiSeverity,
      confidence: ticket.aiConfidence,
      responsibility:
        expert?.responsibilityOverride ??
        (ticket.responsibility !== 'PENDING' ? ticket.responsibility : null),
      roomHint: intake?.signals?.roomHint ?? null,
      safetyLevel: companion?.safety_level ?? null,
      artisanType: ticket.aiSuggestedArtisanType,
      photoCount: ticket.documents.filter((d) => d.url).length,
      intakePhase: intake?.phase ?? null,
    };
  }

  private extractResearch(
    ticket: { aiLastDecision: unknown },
    intake: ReturnType<typeof parseIntakeState>,
    internalBrief: string,
  ): ProBriefingResearch {
    const companion = parseCompanionState(ticket.aiLastDecision);
    const ai = ticket.aiLastDecision as {
      pipelineSteps?: Array<{
        name?: string;
        decision?: string;
        extra?: { rationale?: string };
      }>;
    } | null;

    const pipelineTrace =
      ai?.pipelineSteps?.map(
        (s) =>
          `${s.name ?? '?'} → ${s.decision ?? '—'}${
            s.extra?.rationale ? ` (${s.extra.rationale.slice(0, 120)}…)` : ''
          }`,
      ) ?? [];

    const juristStep = ai?.pipelineSteps?.find(
      (s) => s.name === 'jurist_mistral' || s.name === 'jurist',
    );

    const ficheMatch = internalBrief.match(
      /Fiche métier \([^)]+\) : (.+)/,
    );
    const similarBlock = internalBrief.includes('Affaires proches')
      ? internalBrief.split('Affaires proches :')[1]?.trim() ?? ''
      : '';

    return {
      tradeFiche: ficheMatch?.[1]?.trim() ?? '',
      searchTrigger: companion?.search_trigger ?? null,
      intakeSummary: intake ? buildIntakeSummary(intake) : '',
      similarCases: similarBlock
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('-')),
      juristRationale: juristStep?.extra?.rationale ?? null,
      pipelineTrace,
    };
  }

  private detectEquipment(
    text: string,
    intakeCategory: string | null,
  ): string | null {
    for (const { pattern, label } of EQUIPMENT_PATTERNS) {
      if (pattern.test(text)) return label;
    }
    if (intakeCategory && intakeCategory !== 'GENERIC') {
      return CATEGORY_LABELS[intakeCategory] ?? intakeCategory;
    }
    return null;
  }

  private extractSymptoms(
    text: string,
    intake: ReturnType<typeof parseIntakeState>,
  ): string[] {
    const symptoms: string[] = [];
    const lower = text.toLowerCase();

    const patterns: Array<{ re: RegExp; label: string }> = [
      { re: /fuite|goutte|humide|infiltration/, label: 'Fuite / humidité' },
      { re: /bouch[ée]|ne s['']écoule pas|engorg/, label: 'Évacuation bloquée' },
      { re: /plus (de )?(courant|électricit|lumi[èe]re)/, label: 'Panne électrique' },
      { re: /disjoncteur|compteur/, label: 'Problème disjoncteur / compteur' },
      { re: /odeur|gaz/, label: 'Odeur suspecte' },
      { re: /bruit|grince|siffle/, label: 'Bruit anormal' },
      { re: /fissure|moisissure/, label: 'Dégradation visible' },
      { re: /panne|ne fonctionne pas|en panne/, label: 'Équipement en panne' },
    ];

    for (const { re, label } of patterns) {
      if (re.test(lower) && !symptoms.includes(label)) {
        symptoms.push(label);
      }
    }

    if (intake?.signals?.rainingNow) {
      symptoms.push('Apparition liée aux intempéries');
    }
    if (intake?.signals?.roofLeak) {
      symptoms.push('Infiltration toiture suspectée');
    }

    if (symptoms.length === 0 && text.trim()) {
      const snippet = text.trim().slice(0, 120);
      symptoms.push(snippet);
    }

    return symptoms;
  }

  private async buildNarrative(
    ticket: { title: string; description: string; status: string },
    critical: ProBriefingCritical,
    research: ProBriefingResearch,
    tenantFirstName: string,
    expert: ReturnType<typeof parseExpertRectification>,
  ): Promise<{ narrative: string; fromLlm: boolean }> {
    if (expert) {
      return {
        narrative:
          `Suite à l'expertise terrain de ${expert.expertDisplayName}, le diagnostic retenu est : ${expert.correctedDiagnosis}. ` +
          `Motif : ${expert.reason}. ` +
          (expert.modelHint ? `Équipement : ${expert.modelHint}. ` : '') +
          'La proposition IA initiale est archivée ; toute discussion s’appuie sur ce constat expert.',
        fromLlm: false,
      };
    }

    const systemPrompt = [
      'Tu rédiges un Pro Briefing technique pour un technicien ou référent bailleur.',
      'Structure : 1) Contexte (1 phrase) 2) Symptômes et équipement 3) Constats intake 4) Orientation charge/intervention 5) Points de vigilance.',
      'Maximum 8 lignes. Français professionnel. Pas de markdown.',
    ].join('\n');

    const userPrompt = [
      `Signalement : ${ticket.title}`,
      `Description : ${ticket.description}`,
      `Locataire : ${tenantFirstName || '—'}`,
      `Catégorie : ${critical.categoryLabel}`,
      `Équipement : ${critical.model ?? 'non identifié'}`,
      `Symptômes : ${critical.symptoms.join(', ')}`,
      `Charge : ${critical.responsibility ?? 'diagnostic en cours'}`,
      `Gravité IA : ${critical.severity ?? '—'} (confiance ${critical.confidence ?? '—'})`,
      `Sécurité compagnon : ${critical.safetyLevel ?? '—'}`,
      research.intakeSummary,
      research.searchTrigger ? `Recherche : ${research.searchTrigger}` : '',
      research.juristRationale ? `Motif : ${research.juristRationale}` : '',
      research.tradeFiche ? `Fiche métier : ${research.tradeFiche}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const llm = await this.host.chatStructured(systemPrompt, userPrompt, 500);
    if (llm) return { narrative: llm, fromLlm: true };

    return {
      narrative: this.ruleBasedNarrative(ticket, critical, research, tenantFirstName),
      fromLlm: false,
    };
  }

  private ruleBasedNarrative(
    ticket: { title: string; description: string },
    critical: ProBriefingCritical,
    research: ProBriefingResearch,
    tenantFirstName: string,
  ): string {
    const lines = [
      `${tenantFirstName ? `${tenantFirstName} signale` : 'Signalement'} : ${ticket.title}.`,
      critical.model
        ? `Équipement / zone : ${critical.model}.`
        : `Métier : ${critical.categoryLabel}.`,
      critical.symptoms.length
        ? `Symptômes : ${critical.symptoms.join(', ')}.`
        : ticket.description.slice(0, 160),
      critical.responsibility
        ? `Charge retenue : ${critical.responsibility}.`
        : 'Diagnostic IA en cours.',
      research.searchTrigger
        ? `Piste recherche : ${research.searchTrigger}.`
        : '',
      critical.safetyLevel && critical.safetyLevel !== 'green'
        ? `Niveau sécurité compagnon : ${critical.safetyLevel} — prudence sur site.`
        : '',
      critical.photoCount > 0
        ? `${critical.photoCount} photo(s) disponible(s).`
        : 'Aucune photo jointe pour l’instant.',
    ].filter(Boolean);
    return lines.join('\n');
  }

  private fallbackAnswer(briefing: ProBriefing, question: string): string {
    const q = question.toLowerCase();
    if (/charge|bailleur|locataire|responsabilit/.test(q)) {
      return briefing.critical.responsibility
        ? `Charge retenue sur ce dossier : ${briefing.critical.responsibility}. ${briefing.research.juristRationale ?? ''}`.trim()
        : 'Le diagnostic de charge n’est pas encore finalisé. Consultez le fil locataire ou relancez l’analyse IA.';
    }
    if (/sympt[ôo]me|probl[èe]me|quoi|constat/.test(q)) {
      return `Symptômes recensés : ${briefing.critical.symptoms.join(', ') || briefing.description.slice(0, 200)}.`;
    }
    if (/photo|image/.test(q)) {
      return briefing.critical.photoCount > 0
        ? `${briefing.critical.photoCount} photo(s) jointe(s) au dossier.`
        : 'Aucune photo n’a encore été transmise par le locataire.';
    }
    if (/siphon|d[ée]bouch|lavabo|[ée]vier/.test(q) && briefing.research.intakeSummary) {
      return briefing.research.intakeSummary;
    }
    return (
      `${briefing.narrativeSummary}\n\n` +
      'Mode hors-ligne : configurez GROQ_API_KEY pour des réponses ciblées à vos questions.'
    );
  }
}
