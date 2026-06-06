import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  appendDoctrineLesson,
  buildArchitectDoctrinePrompt,
  extractDoctrineSubject,
  loadDoctrineBibliotheque,
  rejectDoctrineLesson,
  resolveDoctrineDirectory,
  signDoctrineLesson,
} from './living-doctrine-stylo';

describe('living-doctrine-stylo', () => {
  const prevCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctrine-test-'));
    process.chdir(tempDir);
    fs.mkdirSync(path.join(tempDir, 'knowledge', 'doctrine'), { recursive: true });
  });

  afterEach(() => {
    process.chdir(prevCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('appendDoctrineLesson — écrit PENDING (non visible bibliothèque)', () => {
    const lesson = appendDoctrineLesson({
      author: 'enqueteur',
      title: 'Test infiltration',
      body: 'Tache au plafond après pluie → envisager enveloppe avant plomberie.',
    });
    expect(fs.existsSync(lesson.filePath)).toBe(true);
    expect(lesson.status).toBe('PENDING_ADMIN_SIGNATURE');
    expect(loadDoctrineBibliotheque(1)).toHaveLength(0);
    const raw = fs.readFileSync(lesson.filePath, 'utf8');
    expect(raw).toMatch(/enveloppe/i);
    expect(raw).toMatch(/PENDING_ADMIN_SIGNATURE/);
  });

  it('resolveDoctrineDirectory — crée le dossier si absent', () => {
    const dir = resolveDoctrineDirectory();
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('signDoctrineLesson — promeut PENDING en SIGNED et injecte bibliothèque', () => {
    const lesson = appendDoctrineLesson({
      author: 'enqueteur',
      title: 'Hauteur interrupteurs',
      body: 'En Guyane, interrupteurs entre 1,00 m et 1,10 m du sol fini.',
    });
    expect(loadDoctrineBibliotheque(5)).toHaveLength(0);

    const signed = signDoctrineLesson(lesson.id, 'architecte@test');
    expect(signed?.status).toBe('SIGNED');
    expect(signed?.signedBy).toBe('architecte@test');
    expect(loadDoctrineBibliotheque(5)).toHaveLength(1);
  });

  it('rejectDoctrineLesson — supprime le fichier et le ledger', () => {
    const lesson = appendDoctrineLesson({
      author: 'archiviste',
      title: 'Test rejet',
      body: 'Leçon à rejeter.',
    });
    expect(rejectDoctrineLesson(lesson.id)).toBe(true);
    expect(fs.existsSync(lesson.filePath)).toBe(false);
    expect(loadDoctrineBibliotheque(5)).toHaveLength(0);
  });

  it('buildArchitectDoctrinePrompt — message Lia pour Architecte', () => {
    const msg = buildArchitectDoctrinePrompt('Leçon enqueteur — Hauteur interrupteurs');
    expect(msg).toContain('Architecte');
    expect(msg).toContain('Hauteur interrupteurs');
    expect(extractDoctrineSubject('Leçon majordome — Test')).toBe('Test');
  });
});
