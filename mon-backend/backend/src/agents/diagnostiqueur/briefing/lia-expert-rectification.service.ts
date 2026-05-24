import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TicketResponsibility, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BailleurScopeService } from '../auth/scope/bailleur-scope.service';
import { LiaConversationService } from './lia-conversation.service';
import { LiaHostService } from './lia-host.service';
import { mergeAiLastDecision } from './lia-intake.service';
import {
  type ExpertRectifyInput,
  type ExpertRectifyResult,
  type ExpertRectificationStored,
  type ExpertSpecialHandling,
  type ExpertTakeCharge,
  SPECIAL_HANDLING_LABELS,
} from './lia-expert-rectification.types';

const TERMINAL_STATUSES: TicketStatus[] = [
  'RESOLVED',
  'CANCELLED',
  'AUTO_CLOSED',
];

/**
 * Boucle de rectification expert — l’humain surcharge le diagnostic IA.
 */
@Injectable()
export class LiaExpertRectificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: BailleurScopeService,
    private readonly conversation: LiaConversationService,
    private readonly host: LiaHostService,
  ) {}

  async rectifyAnalysis(
    ticketId: number,
    userId: number,
    role: string,
    input: ExpertRectifyInput,
  ): Promise<ExpertRectifyResult> {
    const ticket = await this.assertCanRectify(ticketId, userId, role);

    const correctedDiagnosis = input.correctedDiagnosis.trim();
    const reason = input.reason.trim();
    if (!correctedDiagnosis || !reason) {
      throw new BadRequestException('Diagnostic et motif requis.');
    }
    if (!input.responsibility || input.responsibility === 'PENDING') {
      throw new BadRequestException(
        'Indiquez la charge retenue (bailleur, locataire, social…).',
      );
    }

    const specialHandling = input.specialHandling ?? [];
    const takeCharge = input.takeCharge !== false;
    const expertName = await this.resolveExpertDisplayName(userId, role);
    const correctedAt = new Date().toISOString();
    const aiSnapshot = ticket.aiLastDecision
      ? JSON.parse(JSON.stringify(ticket.aiLastDecision))
      : null;

    const expertRectification: ExpertRectificationStored = {
      authority: 'EXPERT_VALIDATED',
      expertUserId: userId,
      expertDisplayName: expertName,
      reason,
      correctedDiagnosis,
      modelHint:
        input.modelHint?.trim() ||
        (specialHandling.includes('STRUCTURAL_INFILTRATION')
          ? 'Structure / étanchéité bâtiment'
          : null),
      responsibilityOverride: input.responsibility,
      specialHandling,
      vulnerableDetail: input.vulnerableDetail?.trim() || null,
      takeCharge,
      correctedAt,
      aiSnapshotBeforeOverride: aiSnapshot,
    };

    const messageForTenant = await this.buildExpertSynthesis(
      expertName,
      correctedDiagnosis,
      reason,
      input.modelHint,
      specialHandling,
      input.responsibility,
    );

    const historyNote = {
      at: correctedAt,
      kind: 'EXPERT_RECTIFIED' as const,
      label: 'Diagnostic validé par l’expert',
      detail:
        `${expertName} : ${correctedDiagnosis}` +
        (reason ? ` — Motif : ${reason}` : '') +
        ` — Charge : ${input.responsibility}`,
    };

    const prev = ticket.aiLastDecision as {
      landlordHistoryNotes?: unknown[];
    } | null;
    const notes = Array.isArray(prev?.landlordHistoryNotes)
      ? [...prev.landlordHistoryNotes, historyNote]
      : [historyNote];

    if (specialHandling.length > 0) {
      notes.push({
        at: correctedAt,
        kind: 'EXPERT_RECTIFIED' as const,
        label: 'Cas sensible — prise en charge',
        detail:
          specialHandling.map((h) => SPECIAL_HANDLING_LABELS[h]).join(' ; ') +
          (expertRectification.vulnerableDetail
            ? ` — ${expertRectification.vulnerableDetail}`
            : ''),
      });
    }

    const expertTakeCharge: ExpertTakeCharge | undefined = takeCharge
      ? {
          expertUserId: userId,
          expertDisplayName: expertName,
          takenAt: correctedAt,
        }
      : undefined;

    const mergedDecision = mergeAiLastDecision(ticket.aiLastDecision, {
      diagnosticAuthority: 'EXPERT_VALIDATED',
      expertRectification,
      expertTakeCharge,
      messageForTenant,
      landlordHistoryNotes: notes,
      expertValidatedAt: correctedAt,
    });

    let status: TicketStatus = ticket.status;
    if (
      takeCharge &&
      !TERMINAL_STATUSES.includes(ticket.status as TicketStatus)
    ) {
      status = 'IN_PROGRESS';
    }

    let aiCategory = ticket.aiCategory;
    if (specialHandling.includes('STRUCTURAL_INFILTRATION')) {
      aiCategory = aiCategory ?? 'ROOFING';
    }

    if (specialHandling.includes('VULNERABLE_TENANT')) {
      await this.ensureVulnerableSocialCase(
        ticket,
        expertName,
        expertRectification.vulnerableDetail,
      );
    }

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        responsibility: input.responsibility,
        status,
        aiCategory,
        aiLastDecision: mergedDecision as object,
        updatedAt: new Date(),
      },
    });

    await this.conversation.appendMessage(
      ticketId,
      'LIA_SYSTEM',
      `Diagnostic mis à jour par ${expertName} (expertise terrain).`,
    );

    await this.conversation.appendMessage(
      ticketId,
      'LIA_HOST',
      messageForTenant,
    );

    return {
      ticketId,
      authority: 'EXPERT_VALIDATED',
      messageForTenant,
      expertRectification,
    };
  }

  private async ensureVulnerableSocialCase(
    ticket: {
      id: number;
      tenantId: number;
      housing: { landlordId: number };
    },
    expertName: string,
    detail?: string | null,
  ) {
    const note = [
      `Ouverture suite à expertise terrain (${expertName}).`,
      'Locataire âgé ou en situation de handicap — suivi prioritaire.',
      detail?.trim() ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    const existing = await this.prisma.socialCase.findUnique({
      where: { triggerTicketId: ticket.id },
    });
    if (existing) {
      await this.prisma.socialCase.update({
        where: { id: existing.id },
        data: {
          priority: 'HIGH',
          category: 'SOCIAL',
          notes: existing.notes ? `${existing.notes}\n\n${note}` : note,
        },
      });
      return;
    }

    await this.prisma.socialCase.create({
      data: {
        tenantId: ticket.tenantId,
        bailleurId: ticket.housing.landlordId,
        status: 'OPEN',
        category: 'SOCIAL',
        priority: 'HIGH',
        notes: note,
        triggerTicketId: ticket.id,
      },
    });
  }

  private async buildExpertSynthesis(
    expertName: string,
    correctedDiagnosis: string,
    reason: string,
    modelHint?: string,
    specialHandling: ExpertSpecialHandling[] = [],
    responsibility?: TicketResponsibility,
  ): Promise<string> {
    const prefix = `Suite à l'expertise terrain de ${expertName}, `;
    const handlingHint = specialHandling
      .map((h) => SPECIAL_HANDLING_LABELS[h])
      .join(' ; ');
    const systemPrompt = [
      'Tu es Lia, assistante technique logement.',
      'Un expert terrain vient de corriger ton diagnostic initial.',
      'Tu ne contestes jamais l’expert : tu reformules humblement et proposes une aide concrète (procédure, pièce, prochaine étape).',
      specialHandling.includes('VULNERABLE_TENANT')
        ? 'Le locataire est en situation de vulnérabilité : ton ton est particulièrement bienveillant et rassurant, sans dramatiser.'
        : '',
      specialHandling.includes('STRUCTURAL_INFILTRATION')
        ? 'Il s’agit d’un impact possible sur la structure du bâtiment : insiste sur la prise en charge rapide par le bailleur, sans alarmisme.'
        : '',
      '2 à 4 phrases. Français. Pas de conseil juridique personnalisé.',
    ]
      .filter(Boolean)
      .join('\n');

    const userPrompt = [
      `Correction expert : ${correctedDiagnosis}`,
      `Motif : ${reason}`,
      modelHint ? `Équipement / zone : ${modelHint}` : '',
      responsibility ? `Charge retenue : ${responsibility}` : '',
      handlingHint ? `Cas sensible : ${handlingHint}` : '',
      `Commence par : "${prefix}" puis le diagnostic retenu.`,
      'Termine par une question utile (ex. procédure, pièce, prochaine étape).',
    ]
      .filter(Boolean)
      .join('\n');

    const llm = await this.host.chatStructured(systemPrompt, userPrompt, 360);
    if (llm) return llm.startsWith(prefix) ? llm : `${prefix}${llm}`;

    let fallback =
      `${prefix}le diagnostic retenu est le suivant : ${correctedDiagnosis}. ` +
      `Motif : ${reason}. `;
    if (specialHandling.includes('STRUCTURAL_INFILTRATION')) {
      fallback +=
        'Votre bailleur prend en charge cette affaire en priorité compte tenu de l’impact possible sur le bâtiment. ';
    }
    if (specialHandling.includes('VULNERABLE_TENANT')) {
      fallback +=
        'Nous traitons votre demande en priorité compte tenu de votre situation. ';
    }
    fallback +=
      (modelHint ? `Équipement concerné : ${modelHint}. ` : '') +
      'Souhaitez-vous que je recherche la procédure adaptée pour cette intervention ?';
    return fallback;
  }

  private async resolveExpertDisplayName(
    userId: number,
    role: string,
  ): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });
    if (role === 'AGENT') {
      const agent = await this.prisma.agentProfile.findUnique({
        where: { userId },
        select: { fonction: true },
      });
      if (agent?.fonction?.trim()) return agent.fonction.trim();
    }
    if (role === 'BAILLEUR') {
      const lp = await this.prisma.landlordProfile.findUnique({
        where: { userId },
        select: { name: true },
      });
      if (lp?.name?.trim()) return `Référent ${lp.name.trim()}`;
    }
    if (role === 'ADMIN') return 'Expert plateforme';
    const mail = user?.email?.split('@')[0];
    return mail ? `Expert ${mail}` : 'Expert terrain';
  }

  private async assertCanRectify(
    ticketId: number,
    userId: number,
    role: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: true,
        housing: { include: { landlord: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');

    if (role === 'ADMIN') return ticket;

    if (role === 'PRESTATAIRE') {
      const slot = await this.prisma.planningSlot.findFirst({
        where: { ticketId, artisanId: userId },
      });
      if (!slot) {
        throw new BadRequestException(
          'Rectification réservée aux référents ou à un ticket qui vous est assigné.',
        );
      }
      return ticket;
    }

    if (role === 'BAILLEUR' || role === 'AGENT') {
      const scope = await this.scopeService.resolve({ id: userId, role });
      if (!scope.landlordProfileId) {
        throw new BadRequestException('Profil bailleur introuvable');
      }
      const landlordId =
        ticket.landlordProfileId ?? ticket.housing.landlordId;
      if (landlordId !== scope.landlordProfileId) {
        throw new BadRequestException('Ticket hors périmètre');
      }
      if (role === 'AGENT' && scope.agenceId != null) {
        const housing = await this.prisma.housing.findUnique({
          where: { id: ticket.housingId },
          select: { agenceId: true },
        });
        if (housing?.agenceId !== scope.agenceId) {
          throw new BadRequestException('Ticket hors de votre secteur');
        }
      }
      return ticket;
    }

    throw new BadRequestException(
      'Seuls référent, bailleur, admin ou technicien assigné peuvent rectifier.',
    );
  }
}
