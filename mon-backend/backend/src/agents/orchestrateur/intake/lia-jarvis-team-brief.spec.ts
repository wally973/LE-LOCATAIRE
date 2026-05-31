import {
  buildDiagnosticianBrief,
  mergeJarvisTeamBrief,
  formatTeamBriefForPrompt,
} from './lia-jarvis-team-brief';
import { loadLegalReferencesCatalogFromFile } from '../../../legal-references/legal-reference.loader';
import { buildArchivistBrief } from './lia-jarvis-team-brief';

describe('lia-jarvis-team-brief', () => {
  it('clés perdues — Archiviste = charge locataire, interdit promesse bailleur', async () => {
    const catalog = loadLegalReferencesCatalogFromFile();
    const legalRefs = {
      getCatalog: async () => catalog,
      search: async () =>
        catalog.entries.filter((e) =>
          /serrure|87-712|clé/i.test(`${e.title} ${e.summary}`),
        ),
    } as never;

    const archivist = await buildArchivistBrief(legalRefs, {
      title: 'Clés perdues',
      description: 'Marie a perdu ses clés, elle ne peut plus entrer chez elle.',
      message: '',
    });

    expect(archivist.chargeHint).toBe('LOCATAIRE');
    expect(archivist.constraints.join(' ')).toMatch(/87-712|charge locataire/i);
    expect(archivist.constraints.join(' ')).toMatch(/INTERDIT|interdit/i);
    expect(archivist.constraints.join(' ')).toMatch(/technicien|gratuit|bailleur/i);
  });

  it('clés perdues — Diagnostiqueur master-diagnostic-rules = LOCATAIRE', () => {
    const diagnostician = buildDiagnosticianBrief({
      title: 'Clés perdues',
      description: 'Marie a perdu ses clés.',
      message: 'quand pouvez-vous venir ouvrir la porte ?',
    });

    expect(diagnostician.domainId).toBe('CARPENTRY');
    expect(diagnostician.responsibilityHint).toBe('LOCATAIRE');
    expect(diagnostician.leadingHypothesis).toMatch(/clé|Clé/i);
  });

  it('brief équipe — prompt Groq contient Archiviste et Diagnostiqueur', async () => {
    const catalog = loadLegalReferencesCatalogFromFile();
    const legalRefs = {
      getCatalog: async () => catalog,
      search: async () => catalog.entries.slice(0, 3),
    } as never;

    const archivist = await buildArchivistBrief(legalRefs, {
      title: 'Clés perdues',
      description: 'Marie a perdu ses clés.',
      message: '',
    });
    const diagnostician = buildDiagnosticianBrief({
      title: 'Clés perdues',
      description: 'Marie a perdu ses clés.',
      message: '',
    });
    const brief = mergeJarvisTeamBrief({
      title: 'Clés perdues',
      description: 'Marie a perdu ses clés.',
      message: '',
      archivist,
      diagnostician,
    });

    expect(brief.councilEchoes.length).toBeGreaterThanOrEqual(2);
    expect(brief.councilEchoes[0].insight).toMatch(/\[Archiviste\]/);
    expect(brief.councilEchoes.some((e) => /\[Diagnostiqueur\]/.test(e.insight))).toBe(true);

    const prompt = formatTeamBriefForPrompt(brief);
    expect(prompt).toMatch(/BRIEF ÉQUIPE/);
    expect(prompt).toMatch(/Archiviste/);
    expect(prompt).toMatch(/Diagnostiqueur/);
    expect(prompt).toMatch(/master-diagnostic-rules/);
  });
});
