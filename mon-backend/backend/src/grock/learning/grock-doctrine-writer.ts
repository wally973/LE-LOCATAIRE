import * as fs from 'fs';
import type { GrockDomain } from '../grock-domain';
import {
  getGrockLedgerPath,
  invalidateGrockLedgerCache,
  readGrockLedgerFresh,
  type GrockDeductionLedger,
  type GrockDeductionPrinciple,
} from '../grock-deduction-ledger';

/**
 * Étage 3 de la boucle d'apprentissage — ÉCRITURE DE DOCTRINE (arbitrage).
 *
 * L'humain (Architecte) transforme un cas détecté en LEÇON. La leçon entre
 * d'abord en `draft` : le gate de signature est le passage `draft → validated`.
 * Tant qu'une leçon n'est pas `validated`, elle n'est PAS injectée au raisonnement
 * (cf. `loadGrockDeductionDoctrine`). NuclearFlush reste intact : rien n'influence
 * un ticket sans cette signature humaine explicite.
 */

export interface ProposeLessonInput {
  id: string;
  appliesTo: Array<GrockDomain | 'ALL'>;
  principle: string;
  reasoningShift: string;
  thinkingInstruction: string;
  acknowledgmentInstruction: string;
  examples?: string[];
  sourceCandidate?: { kind: string; photoHash?: string | null };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function writeLedger(ledger: GrockDeductionLedger): void {
  ledger.updatedAt = today();
  fs.writeFileSync(
    getGrockLedgerPath(),
    JSON.stringify(ledger, null, 2) + '\n',
    'utf8',
  );
  invalidateGrockLedgerCache();
}

function normalizeId(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Crée une leçon en `draft` (en attente de signature Architecte). */
export function appendDraftLesson(
  input: ProposeLessonInput,
): GrockDeductionPrinciple {
  const ledger = readGrockLedgerFresh();
  const id = normalizeId(input.id);
  if (!id) throw new Error('Identifiant de leçon vide.');
  if (ledger.principles.some((p) => p.id === id)) {
    throw new Error(`Une leçon « ${id} » existe déjà.`);
  }

  const lesson: GrockDeductionPrinciple = {
    id,
    status: 'draft',
    appliesTo: input.appliesTo?.length ? input.appliesTo : ['GENERAL'],
    principle: input.principle.trim(),
    reasoningShift: input.reasoningShift.trim(),
    thinkingInstruction: input.thinkingInstruction.trim(),
    acknowledgmentInstruction: input.acknowledgmentInstruction.trim(),
    examples: input.examples?.map((e) => e.trim()).filter(Boolean),
    createdAt: today(),
    sourceCandidate: input.sourceCandidate,
  };

  ledger.principles.push(lesson);
  writeLedger(ledger);
  return lesson;
}

/** Signe une leçon `draft` → `validated` (elle devient injectable). */
export function signLesson(
  id: string,
  signataire: string,
): GrockDeductionPrinciple {
  const ledger = readGrockLedgerFresh();
  const lesson = ledger.principles.find((p) => p.id === id);
  if (!lesson) throw new Error(`Leçon introuvable : ${id}`);
  lesson.status = 'validated';
  lesson.signataire = signataire.trim() || 'architecte';
  lesson.signedAt = today();
  writeLedger(ledger);
  return lesson;
}

/** Rejette une leçon. Sécurité : on ne supprime jamais une leçon déjà validée. */
export function rejectLesson(id: string): { ok: true; id: string } {
  const ledger = readGrockLedgerFresh();
  const lesson = ledger.principles.find((p) => p.id === id);
  if (!lesson) throw new Error(`Leçon introuvable : ${id}`);
  if (lesson.status === 'validated') {
    throw new Error(
      `Leçon « ${id} » déjà validée : refus impossible (protège la doctrine active).`,
    );
  }
  ledger.principles = ledger.principles.filter((p) => p.id !== id);
  writeLedger(ledger);
  return { ok: true, id };
}
