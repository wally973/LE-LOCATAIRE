/**
 * Démo Tour 0 — lecture + scène 3D (résultats console).
 * Usage : npx ts-node scripts/demo-spatial-tour0.ts
 */
import {
  buildJarvisConsultation,
  runJarvisSimulation,
} from '../src/agents/orchestrateur/intake/lia-jarvis-simulation.engine';
import { pickSavoirProbe } from '../src/agents/orchestrateur/intake/lia-savoir-clinical-links.loader';
import { spatialSceneToJarvisFacts } from '../src/agents/orchestrateur/intake/lia-jarvis-spatial-scene';

const cases = [
  {
    label: 'Hall et escalier sale',
    title: 'Hall et escalier sale',
    description:
      'Le hall et l’escalier ne sont plus nettoyés, c’est vraiment sale et ça sent mauvais.',
  },
  {
    label: 'Fuite cuisine',
    title: 'Fuite sous l’évier',
    description:
      'De l’eau coule sous l’évier de la cuisine quand j’ouvre le robinet.',
  },
  {
    label: 'Porte serrure',
    title: 'Porte qui ne ferme plus',
    description:
      'Ma porte d’entrée ne ferme plus, la serrure accroche et le pêne ne rentre pas.',
  },
];

for (const c of cases) {
  const sim = runJarvisSimulation({
    title: c.title,
    description: c.description,
    preferredLanguage: 'fr',
    housingKind: 'collective',
  });
  const consult = buildJarvisConsultation({
    simulation: sim,
    title: c.title,
    description: c.description,
    tenantFirstName: 'Marie',
    mode: 'opening',
  });
  const probe = pickSavoirProbe({
    housingKind: 'collective',
    activeFlows: sim.activeFlows,
    resolvedSteps: sim.resolvedSteps,
    language: 'fr',
    title: c.title,
    description: c.description,
  });
  const spatial = spatialSceneToJarvisFacts(sim);

  console.log('\n' + '='.repeat(60));
  console.log('CAS :', c.label);
  console.log('-'.repeat(60));
  console.log('MARIE (ouverture) :');
  console.log(' ', consult.acknowledgment);
  if (consult.nextQuestion) console.log('  ?', consult.nextQuestion);
  console.log('\nSCÈNE 3D :');
  console.log('  pièce    :', sim.scene.room ?? '—');
  console.log('  élément  :', sim.scene.element ?? '—');
  console.log('  ancrage  :', sim.scene.symptomAnchor ?? '—');
  console.log('  flux     :', sim.activeFlows.join(', '));
  console.log('\nVISUALISATION :');
  console.log(' ', sim.visualizationSummary.slice(0, 200) + (sim.visualizationSummary.length > 200 ? '…' : ''));
  console.log('\nJARVISFACTS spatial :', spatial);
  console.log('Sonde Savoir        :', probe?.probe.id ?? '(aucune)');
  console.log('Intake complet      :', consult.intakeComplete);
}
