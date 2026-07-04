import * as fs from 'fs';
import * as path from 'path';
import type { GrockDomain } from './grock-domain';

export interface GrockDeductionPrinciple {
  id: string;
  /** `draft` = en attente de signature Architecte ; `validated` = injecté au raisonnement. */
  status: 'validated' | 'draft';
  appliesTo: Array<GrockDomain | 'ALL'>;
  principle: string;
  reasoningShift: string;
  thinkingInstruction: string;
  acknowledgmentInstruction: string;
  examples?: string[];
  /** Traçabilité arbitrage (boucle d'apprentissage, étage 3). */
  createdAt?: string;
  signataire?: string;
  signedAt?: string;
  sourceCandidate?: { kind: string; photoHash?: string | null };
}

export interface GrockDeductionLedger {
  version: number;
  updatedAt: string;
  purpose: string;
  principles: GrockDeductionPrinciple[];
}

const GROCK_DOMAINS: readonly GrockDomain[] = [
  'CARPENTRY_LOCK',
  'PLUMBING_WATER',
  'HUMIDITY_ENVELOPE',
  'ELECTRICITY',
  'GENERAL',
];

function ledgerPath(): string {
  // Surcharge explicite (ops / tests hermétiques) prioritaire sur la résolution auto.
  const override = process.env.GROCK_LEDGER_PATH?.trim();
  if (override) return override;
  const candidates = [
    path.join(process.cwd(), 'knowledge', 'doctrine', 'GROCK_DEDUCTION_LEDGER.json'),
    path.join(process.cwd(), '..', '..', 'knowledge', 'doctrine', 'GROCK_DEDUCTION_LEDGER.json'),
    path.resolve(__dirname, '..', '..', '..', '..', 'knowledge', 'doctrine', 'GROCK_DEDUCTION_LEDGER.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`GROCK_DEDUCTION_LEDGER.json introuvable (cwd=${process.cwd()})`);
}

/** Chemin résolu du registre (pour l'écriture d'arbitrage). */
export function getGrockLedgerPath(): string {
  return ledgerPath();
}

let cachedLedger: GrockDeductionLedger | null = null;

function readLedgerFile(): GrockDeductionLedger {
  if (cachedLedger) return cachedLedger;
  cachedLedger = JSON.parse(fs.readFileSync(ledgerPath(), 'utf8')) as GrockDeductionLedger;
  return cachedLedger;
}

/** Lecture fraîche (sans cache) — pour l'admin et l'écriture d'arbitrage. */
export function readGrockLedgerFresh(): GrockDeductionLedger {
  return JSON.parse(fs.readFileSync(ledgerPath(), 'utf8')) as GrockDeductionLedger;
}

/**
 * Invalide le cache : après une écriture d'arbitrage (nouvelle leçon signée),
 * le prochain raisonnement doit voir la doctrine à jour.
 */
export function invalidateGrockLedgerCache(): void {
  cachedLedger = null;
}

function normalizeDomains(domain: GrockDomain | GrockDomain[] | string): GrockDomain[] {
  if (Array.isArray(domain)) return domain;
  if (GROCK_DOMAINS.includes(domain as GrockDomain)) return [domain as GrockDomain];
  return ['GENERAL'];
}

function matchesDomain(
  appliesTo: Array<GrockDomain | 'ALL'>,
  domains: GrockDomain[],
): boolean {
  return appliesTo.includes('ALL') || domains.some((item) => appliesTo.includes(item));
}

function loadLedger(domain: GrockDomain | GrockDomain[] | string): string {
  const domains = normalizeDomains(domain);
  const ledger = readLedgerFile();
  const principles = ledger.principles.filter(
    (p) => p.status === 'validated' && matchesDomain(p.appliesTo, domains),
  );

  if (!principles.length) {
    return '--- Doctrine de déduction Grock ---\nAucune leçon validée applicable à ce domaine.';
  }

  const lines = [
    '--- Doctrine de déduction Grock (leçons transférables validées) ---',
    "Ces principes ne sont pas des scénarios : ce sont des outils d'enquête à appliquer dans thinking.",
  ];

  for (const p of principles) {
    lines.push(
      '',
      `## ${p.id}`,
      `Principe : ${p.principle}`,
      `Déplacement de raisonnement : ${p.reasoningShift}`,
      `Thinking : ${p.thinkingInstruction}`,
      `Parole locataire : ${p.acknowledgmentInstruction}`,
    );
    if (p.examples?.length) {
      lines.push(`Exemples transférables : ${p.examples.join(' | ')}`);
    }
  }

  return lines.join('\n');
}

export function loadGrockDeductionDoctrine(
  domain: GrockDomain | GrockDomain[] | string,
): string {
  try {
    return loadLedger(domain).trim();
  } catch {
    return '--- Doctrine de déduction Grock ---\nRegistre indisponible ; poursuivre avec les analogies et le savoir AFPOL.';
  }
}
