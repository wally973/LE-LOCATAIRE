import {
  extractTenantSignalementFacts,
  isPerimeterLegalProbeRedundant,
  isPerimeterQuestionRedundant,
  jarvisAcknowledgeExtractedFacts,
  shouldCompleteIntakeFromFacts,
  jarvisReadSignalement,
} from './lia-tenant-signalement-facts';
import { pickLegalClarificationProbe } from './lia-juridique-savoir.loader';
import { pickSavoirProbe } from './lia-savoir-clinical-links.loader';
import { runJarvisSimulation } from './lia-jarvis-simulation.engine';

describe('lia-tenant-signalement-facts', () => {
  it('hall + escalier + salubrité — périmètre communs résolu', () => {
    const facts = extractTenantSignalementFacts({
      title: 'Hall sale et odeurs',
      description:
        'Le hall de l’immeuble est sale, ça sent les poubelles et plusieurs locataires ont déjà écrit sans réponse.',
    });
    expect(facts.locationScope).toBe('communs');
    expect(facts.perimeterResolved).toBe(true);
    expect(facts.commonsSalubrityLead).toBe(true);
    expect(shouldCompleteIntakeFromFacts(facts)).toBe(true);
  });

  it('« hall et escalier sale » — salubrité communs, pas sonde marche', () => {
    const facts = extractTenantSignalementFacts({
      title: 'Hall et escalier sale',
      description:
        'Le hall et l’escalier ne sont plus nettoyés, c’est sale depuis plusieurs semaines.',
    });
    expect(facts.salubriteIssue).toBe(true);
    expect(facts.commonsSalubrityLead).toBe(true);
    expect(facts.commonAreasMentioned).toEqual(
      expect.arrayContaining(['hall', 'escalier']),
    );
    expect(shouldCompleteIntakeFromFacts(facts)).toBe(true);

    const probe = pickSavoirProbe({
      housingKind: 'collective',
      activeFlows: ['mécanique'],
      resolvedSteps: [],
      language: 'fr',
      title: 'Hall et escalier sale',
      description: 'Le hall et l’escalier sont sales.',
    });
    expect(probe?.probe.id).not.toBe('collective_stair_step_safety');

    expect(
      isPerimeterQuestionRedundant(
        "La marche abîmée est à quel niveau de l'escalier ? D'autres marches bougent-elles aussi dans le bâtiment ?",
        facts,
      ),
    ).toBe(true);

    const read = jarvisReadSignalement(
      'Marie',
      'fr',
      'Hall et escalier sale',
      'Le hall et l’escalier sont sales.',
      facts,
    );
    expect(read).toMatch(/j.?ai lu|salubrit/i);
    expect(read).toMatch(/hall|escalier/i);
  });

  it('« depuis des semaines » seul — pas de relance bailleur inventée', () => {
    const desc =
      "Bonjour, depuis des semaines le hall et l'escalier n'est pas nettoyer, cela devient de l'insalubrité";
    const facts = extractTenantSignalementFacts({
      title: 'partie commune',
      description: desc,
    });
    expect(facts.priorLandlordContact).toBe(false);
    const read = jarvisReadSignalement('Marie', 'fr', 'partie commune', desc, facts);
    expect(read).not.toMatch(/relances déjà adressées/i);
  });

  it('tour locataire « hall et escalier » — ne re-sonde pas le logement', () => {
    const opening = extractTenantSignalementFacts({
      title: 'Hall sale',
      description: 'Le hall est insalubre.',
    });
    const after = extractTenantSignalementFacts({
      title: 'Hall sale',
      description: 'Le hall est insalubre.',
      message:
        'Surtout le hall et la cage d’escalier. Mon appartement est propre, c’est vraiment les parties communes.',
      prior: opening,
    });
    expect(after.locationScope).toBe('communs');
    expect(after.perimeterResolved).toBe(true);
    expect(
      isPerimeterQuestionRedundant(
        'Le souci est dans votre logement, dans le hall ou les escaliers, ou les deux ?',
        after,
      ),
    ).toBe(true);
    expect(
      isPerimeterQuestionRedundant(
        'Pour cibler la panne : plutôt avant le logement (antenne, box, réseau), ou plutôt chez vous (câble, prise, décodeur) ?',
        after,
      ),
    ).toBe(true);
  });

  it('pas de sonde legal_clarify_decence si communs déjà précisés', () => {
    const facts = extractTenantSignalementFacts({
      title: 'Hall sale',
      description: 'Hall et escalier sales, odeur de poubelles.',
      message: 'dans le hall et l’escalier depuis longtemps',
    });
    expect(isPerimeterLegalProbeRedundant('legal_clarify_decence', facts)).toBe(true);
    const probe = pickLegalClarificationProbe({
      title: 'Hall sale',
      description: 'Hall et escalier sales, odeur de poubelles.',
      message: 'dans le hall et l’escalier',
      language: 'fr',
      resolvedSteps: ['tenant_perimeter_resolved', 'legal_clarification_answered'],
    });
    expect(probe).toBeNull();
  });

  it('reformulation Jarvis — entend hall et escalier, pas le logement', () => {
    const facts = extractTenantSignalementFacts({
      title: 'Hall sale',
      description: 'Insalubrité hall et escalier.',
      message: 'le hall et l’escalier, je paie mes charges',
    });
    const ack = jarvisAcknowledgeExtractedFacts('Marie', 'fr', facts);
    expect(ack).toMatch(/entendu|hall|escalier/i);
    expect(ack).not.toMatch(/appartement.*\?/);
  });

  it('porte bloquée + enfant — urgence sécurité et fil mécanique', () => {
    const facts = extractTenantSignalementFacts({
      title: 'logement',
      description:
        'Bonjour, la porte de la chambre de mon fils est bloqué, il est dans la chambre',
    });
    expect(facts.safetyUrgent).toBe(true);
    expect(facts.mechanicalDoorIssue).toBe(true);
    expect(shouldCompleteIntakeFromFacts(facts)).toBe(false);
  });

  it('titre générique « logement » — la lecture reprend la description, pas le titre seul', () => {
    const desc =
      'Bonjour, la porte de la chambre de mon fils est bloqué, il est dans la chambre';
    const read = jarvisReadSignalement('Marie', 'fr', 'logement', desc, null);
    expect(read).toMatch(/porte|chambre|bloqu|fils/i);
    expect(read).not.toMatch(/signalement — logement\./i);
  });

  it('document pour madame Pascal — demande administrative, pas panne', () => {
    const desc =
      "Bonjour, j'ai un document à remettre à madame Pascal, travail t-elle aujourd'hui";
    const facts = extractTenantSignalementFacts({
      title: 'logement',
      description: desc,
    });
    expect(facts.administrativeLead).toBe(true);
    expect(shouldCompleteIntakeFromFacts(facts)).toBe(true);
    const read = jarvisReadSignalement('Marie', 'fr', 'logement', desc, facts);
    expect(read).toMatch(/document|madame|Pascal|aujourd/i);
  });

  it('évier eau sale inondé — urgence plomberie, pas salubrité communs', () => {
    const desc =
      "bonjour, c'est urgent mon évier est rempli d'une eau sale et ma cuisine est inonder";
    const facts = extractTenantSignalementFacts({
      title: 'logement évier cuisine',
      description: desc,
    });
    expect(facts.plumbingUrgent).toBe(true);
    expect(facts.plumbingFlooding).toBe(true);
    expect(facts.plumbingBackupLead).toBe(true);
    expect(facts.plumbingEuRefoulementLead).toBe(true);
    expect(shouldCompleteIntakeFromFacts(facts)).toBe(true);
    expect(facts.commonsSalubrityLead).toBe(false);
    const read = jarvisReadSignalement('Marie', 'fr', 'logement évier cuisine', desc, facts);
    expect(read).toMatch(/urgent|eau sale|inond/i);
    expect(read).not.toMatch(/logement évier cuisine\./i);
  });

  it('correction portail vs boîte aux lettres — pas de re-sonde mailbox', () => {
    const prior = runJarvisSimulation({
      title: 'Boîte aux lettres bloquée',
      description:
        'Ma boîte aux lettres ne s’ouvre plus bien. La clé tourne difficilement.',
      preferredLanguage: 'fr',
    });
    const sim = runJarvisSimulation({
      title: 'Boîte aux lettres bloquée',
      description:
        'Ma boîte aux lettres ne s’ouvre plus bien. La clé tourne difficilement.',
      message: 'je vous parle de portail',
      prior,
      preferredLanguage: 'fr',
    });
    expect(sim.tenantFacts?.subjectCorrected).toBe(true);
    expect(sim.tenantFacts?.equipmentSubject).toBe('portail');
    expect(sim.resolvedSteps).toContain('savoir_mailbox_probe');

    const picked = pickSavoirProbe({
      housingKind: 'collective',
      activeFlows: ['mécanique'],
      resolvedSteps: sim.resolvedSteps,
      language: 'fr',
      title: 'Boîte aux lettres bloquée',
      description: 'Ma boîte aux lettres ne s’ouvre plus bien.',
      message: 'je vous parle de portail',
    });
    expect(picked?.probe.id).toBe('parking_gate_stuck');
  });
});
