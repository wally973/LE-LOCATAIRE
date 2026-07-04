/**
 * Jacques — Cyber-Gardien (couche externe).
 * Hors délibération technique : forteresse, pas cockpit.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  LivingBuildingState,
  LivingCyberGardienAudit,
  LivingPendingDoctrineLesson,
} from './living-building-state.types';
import {
  detectMemoryGhosts,
  forgePristineLivingState,
  purgeJarvisCognitiveFacts,
} from './living-tabula-rasa';
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import {
  rejectDoctrineLesson,
  signDoctrineLesson,
  type DoctrineLesson,
} from './living-doctrine-stylo';

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /oublie\s+(tes|vos|toutes)\s+(instructions|r[eè]gles)/i,
  /system\s*prompt/i,
  /tu\s+es\s+maintenant/i,
  /\[INST\]|\[\/INST\]/i,
  /<\|im_start\|>|<\|im_end\|>/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+message/i,
  /override\s+(safety|security)/i,
];

export interface CyberInputAudit {
  blocked: boolean;
  reason: string | null;
  sanitizedMessage: string;
}

export interface CyberMemoryAudit {
  ok: boolean;
  ghosts: string[];
  remediatedState: LivingBuildingState | null;
}

@Injectable()
export class LivingCyberGardienService {
  private readonly logger = new Logger(LivingCyberGardienService.name);

  /** Mission 1 — sécurité des inputs (injection / ordres malveillants). */
  auditInput(message: string): CyberInputAudit {
    const trimmed = message.trim();
    if (!trimmed) {
      return { blocked: false, reason: null, sanitizedMessage: trimmed };
    }

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        const reason = 'Tentative d’injection ou d’ordre système détectée.';
        this.logger.warn(`[Cyber-Gardien] Input bloqué — ${pattern}`);
        return { blocked: true, reason, sanitizedMessage: trimmed };
      }
    }

    return { blocked: false, reason: null, sanitizedMessage: trimmed };
  }

  /** Mission 2 — intégrité mémoire post-NuclearFlush, avant parole Lia. */
  auditMemoryIntegrity(params: {
    state: LivingBuildingState;
    title: string;
    description: string;
    jarvisFacts?: Record<string, string>;
    language: CompanionLanguage;
    tenantFirstName?: string;
    ageBand?: 'senior' | 'adult' | 'young' | 'unknown';
    creolePreferred?: boolean;
  }): CyberMemoryAudit {
    const ghosts = detectMemoryGhosts({
      state: params.state,
      title: params.title,
      description: params.description,
      jarvisFacts: params.jarvisFacts,
    });

    if (!ghosts.length) {
      return { ok: true, ghosts: [], remediatedState: null };
    }

    this.logger.warn(`[Cyber-Gardien] Fantômes détectés — ${ghosts.join(' · ')}`);

    const remediatedState = forgePristineLivingState({
      title: params.title,
      description: params.description,
      language: params.language,
      tenantFirstName: params.tenantFirstName ?? params.state.humanBarrier.displayName,
      ageBand: params.ageBand ?? params.state.humanBarrier.ageBand,
      livesAlone: params.state.humanBarrier.livesAlone,
      creolePreferred: params.creolePreferred ?? params.state.humanBarrier.creolePreferred,
      interlocutorFace: params.state.symmetricDeliberation?.interlocutorFace,
    });

    return { ok: false, ghosts, remediatedState };
  }

  /** Mission 3 — doctrine : seules les leçons PENDING passent ; signature réservée Admin. */
  gateDoctrineLessons(
    pending: LivingPendingDoctrineLesson[],
  ): { pending: LivingPendingDoctrineLesson[]; murmures: string[] } {
    if (!pending.length) {
      return { pending: [], murmures: [] };
    }

    const gated = pending.filter((l) => l.status === 'PENDING_ADMIN_SIGNATURE');
    const murmures = gated.map(
      (l) =>
        `Doctrine en attente signature Admin — « ${l.title} » (${l.author}) · ${l.id}`,
    );
    for (const m of murmures) {
      this.logger.log(`[Cyber-Gardien] ${m}`);
    }
    return { pending: gated, murmures };
  }

  /** Signature doctrine — flux Admin uniquement (Registre de Sagesse). */
  signDoctrineAsAdmin(lessonId: string, signedBy: string): DoctrineLesson {
    const who = signedBy?.trim();
    if (!who) {
      throw new NotFoundException('Signature Admin requise.');
    }
    const signed = signDoctrineLesson(lessonId, who);
    if (!signed) {
      throw new NotFoundException(`Leçon doctrine introuvable : ${lessonId}`);
    }
    this.logger.log(`[Cyber-Gardien] Doctrine signée — ${lessonId} par ${who}`);
    return signed;
  }

  rejectDoctrineAsAdmin(lessonId: string): boolean {
    const ok = rejectDoctrineLesson(lessonId);
    if (ok) {
      this.logger.log(`[Cyber-Gardien] Doctrine rejetée — ${lessonId}`);
    }
    return ok;
  }

  buildAuditRecord(parts: {
    inputBlocked: boolean;
    inputBlockReason: string | null;
    memoryOk: boolean;
    ghosts: string[];
    doctrineMurmures: string[];
  }): LivingCyberGardienAudit {
    return {
      layer: 'CYBER_GARDIEN',
      inputBlocked: parts.inputBlocked,
      inputBlockReason: parts.inputBlockReason,
      memoryIntegrityOk: parts.memoryOk,
      ghostsDetected: parts.ghosts,
      doctrineMurmures: parts.doctrineMurmures,
      deliberationFiltered: false,
      auditedAt: new Date().toISOString(),
    };
  }

  /** Message locataire quand l’input est bloqué. */
  buildInputBlockedParole(displayName: string): string {
    const name = displayName.trim() || 'Marie';
    return (
      `${name}, je ne peux pas traiter ce message tel quel — ` +
      'reformulez votre situation sur le logement (ce que vous voyez, depuis quand).'
    );
  }

  /** Purge jarvisFacts — exposé pour DoctrineLedger et sessions. */
  purgeCognitiveFacts(facts: Record<string, string> | undefined): Record<string, string> {
    return purgeJarvisCognitiveFacts(facts);
  }
}
