import {
  buildJarvisConsultation,
  runJarvisSimulation,
} from './lia-jarvis-simulation.engine';
import { pickSavoirProbe } from './lia-savoir-clinical-links.loader';

describe('lia-jarvis-spatial-scene', () => {
  it('hall et escalier sale — scène communs + flux air, pas mécanique', () => {
    const sim = runJarvisSimulation({
      title: 'Hall et escalier sale',
      description:
        'Le hall et l’escalier ne sont plus nettoyés, c’est sale depuis plusieurs semaines.',
      preferredLanguage: 'fr',
      housingKind: 'collective',
    });

    expect(sim.tenantFacts?.commonsSalubrityLead).toBe(true);
    expect(sim.scene.room).toBe('hall');
    expect(sim.scene.element).toMatch(/salubrit|ménage/i);
    expect(sim.activeFlows).toEqual(['air']);
    expect(sim.activeFlows).not.toContain('mécanique');
    expect(sim.visualizationSummary).toMatch(/visualise.*hall|salubrit|propreté/i);
    expect(sim.hypotheses.some((h) => h.active && h.id === 'commons_salubrity')).toBe(true);

    const probe = pickSavoirProbe({
      housingKind: 'collective',
      activeFlows: sim.activeFlows,
      resolvedSteps: sim.resolvedSteps,
      language: 'fr',
      title: 'Hall et escalier sale',
      description: 'Le hall et l’escalier sont sales.',
    });
    expect(probe?.probe.id).not.toBe('collective_stair_step_safety');
  });

  it('ouverture — lecture + scène visible dans la consultation', () => {
    const sim = runJarvisSimulation({
      title: 'Hall et escalier sale',
      description: 'Hall et escalier insalubres, odeur de poubelles.',
      preferredLanguage: 'fr',
      housingKind: 'collective',
    });
    const consult = buildJarvisConsultation({
      simulation: sim,
      title: 'Hall et escalier sale',
      description: 'Hall et escalier insalubres, odeur de poubelles.',
      tenantFirstName: 'Marie',
      mode: 'opening',
    });

    expect(consult.intakeComplete).toBe(true);
    expect(consult.nextQuestion).toBeNull();
    expect(consult.acknowledgment).toMatch(/j.?ai lu|salubrit/i);
    expect(consult.visualizationNote).toMatch(/visualise|Lieu|hall|salubrit/i);
  });

  it('fuite évier — scène plomberie conservée', () => {
    const sim = runJarvisSimulation({
      title: 'Fuite sous l’évier',
      description: 'De l’eau coule sous l’évier de la cuisine quand j’ouvre le robinet.',
      preferredLanguage: 'fr',
    });
    expect(sim.domain).toBe('plumbing_sink');
    expect(sim.scene.room).toBe('cuisine');
    expect(sim.activeFlows).toContain('eau');
    expect(sim.visualizationSummary).toMatch(/évier|eau|flexible|robinet/i);
  });

  it('portail — scène accès, pas boîte aux lettres', () => {
    const prior = runJarvisSimulation({
      title: 'Boîte aux lettres bloquée',
      description: 'Ma boîte aux lettres ne s’ouvre plus.',
      preferredLanguage: 'fr',
      housingKind: 'collective',
    });
    const sim = runJarvisSimulation({
      title: 'Boîte aux lettres bloquée',
      description: 'Ma boîte aux lettres ne s’ouvre plus.',
      message: 'je vous parle de portail',
      prior,
      preferredLanguage: 'fr',
      housingKind: 'collective',
    });
    expect(sim.scene.element).toMatch(/portail/i);
    expect(sim.scene.room).toMatch(/accès|parking/i);
  });

  it('cas Lia-Lab partie commune — une bulle lecture + transmission, sans relance inventée', () => {
    const title = 'partie commune';
    const description =
      "Bonjour, depuis des semaines le hall et l'escalier n'est pas nettoyer, cela devient de l'insalubrité";

    const sim = runJarvisSimulation({
      title,
      description,
      preferredLanguage: 'fr',
      housingKind: 'collective',
    });
    const consult = buildJarvisConsultation({
      simulation: sim,
      title,
      description,
      tenantFirstName: 'Marie',
      mode: 'opening',
    });

    expect(sim.tenantFacts?.priorLandlordContact).toBe(false);
    expect(consult.nextQuestion).toBeNull();
    expect(consult.intakeComplete).toBe(true);
    expect(consult.acknowledgment).toMatch(/j.?ai lu votre signalement/i);
    expect(consult.acknowledgment).toMatch(/salubrit.*hall.*escalier/i);
    expect(consult.acknowledgment).toMatch(/transmets au bailleur/i);
    expect(consult.acknowledgment).not.toMatch(/relances déjà adressées/i);
    expect(consult.acknowledgment).not.toMatch(/marche abîmée/i);
  });
});
