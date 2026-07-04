import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  appendDraftLesson,
  rejectLesson,
  signLesson,
} from './grock-doctrine-writer';
import {
  invalidateGrockLedgerCache,
  loadGrockDeductionDoctrine,
  readGrockLedgerFresh,
} from '../grock-deduction-ledger';

/** Registre temporaire, pour ne jamais toucher au vrai GROCK_DEDUCTION_LEDGER.json. */
const TMP = path.join(os.tmpdir(), `grock-ledger-test-${Date.now()}.json`);

beforeAll(() => {
  fs.writeFileSync(
    TMP,
    JSON.stringify(
      { version: 1, updatedAt: '2026-01-01', purpose: 'test', principles: [] },
      null,
      2,
    ),
  );
  process.env.GROCK_LEDGER_PATH = TMP;
  invalidateGrockLedgerCache();
});

afterAll(() => {
  delete process.env.GROCK_LEDGER_PATH;
  invalidateGrockLedgerCache();
  if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
});

const baseInput = {
  id: 'framing must not steer decision',
  appliesTo: ['GENERAL'] as Array<'GENERAL'>,
  principle: 'La décision doit s’ancrer sur les faits visibles, pas sur le récit.',
  reasoningShift: 'Un cadrage orienté ne change pas la responsabilité.',
  thinkingInstruction: 'Dans thinking, sépare faits visibles / récit / décision.',
  acknowledgmentInstruction: 'Reste neutre, demande une preuve si besoin.',
  sourceCandidate: { kind: 'variance_cadrage', photoHash: 'abc123' },
};

describe("Rédacteur de doctrine Grock (étage 3)", () => {
  it('crée une leçon en draft (non injectée au raisonnement)', () => {
    const lesson = appendDraftLesson(baseInput);
    expect(lesson.id).toBe('FRAMING_MUST_NOT_STEER_DECISION');
    expect(lesson.status).toBe('draft');

    // Un draft ne doit PAS apparaître dans la doctrine injectée.
    invalidateGrockLedgerCache();
    expect(loadGrockDeductionDoctrine('GENERAL')).not.toContain(
      'ancrer sur les faits',
    );
  });

  it('refuse un doublon d’identifiant', () => {
    expect(() => appendDraftLesson(baseInput)).toThrow(/existe déjà/);
  });

  it('signe la leçon → validated (devient injectable)', () => {
    const signed = signLesson('FRAMING_MUST_NOT_STEER_DECISION', 'architecte@test');
    expect(signed.status).toBe('validated');
    expect(signed.signataire).toBe('architecte@test');
    expect(signed.signedAt).toBeTruthy();

    invalidateGrockLedgerCache();
    expect(loadGrockDeductionDoctrine('GENERAL')).toContain(
      's’ancrer sur les faits',
    );
  });

  it('interdit le rejet d’une leçon validée', () => {
    expect(() => rejectLesson('FRAMING_MUST_NOT_STEER_DECISION')).toThrow(
      /déjà validée/,
    );
  });

  it('rejette une leçon draft (suppression)', () => {
    appendDraftLesson({ ...baseInput, id: 'draft_a_jeter' });
    const res = rejectLesson('DRAFT_A_JETER');
    expect(res.ok).toBe(true);
    expect(
      readGrockLedgerFresh().principles.some((p) => p.id === 'DRAFT_A_JETER'),
    ).toBe(false);
  });
});
