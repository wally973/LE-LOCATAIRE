import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  appendDoctrineLesson,
  loadDoctrineBibliotheque,
  resolveDoctrineDirectory,
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

  it('appendDoctrineLesson — écrit un fichier markdown', () => {
    const lesson = appendDoctrineLesson({
      author: 'enqueteur',
      title: 'Test infiltration',
      body: 'Tache au plafond après pluie → envisager enveloppe avant plomberie.',
    });
    expect(fs.existsSync(lesson.filePath)).toBe(true);
    expect(loadDoctrineBibliotheque(1)[0]?.body).toMatch(/enveloppe/i);
  });

  it('resolveDoctrineDirectory — crée le dossier si absent', () => {
    const dir = resolveDoctrineDirectory();
    expect(fs.existsSync(dir)).toBe(true);
  });
});
