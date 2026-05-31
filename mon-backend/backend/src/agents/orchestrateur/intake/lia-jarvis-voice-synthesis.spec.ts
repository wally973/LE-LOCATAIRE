import { inferHousingPerspective } from './lia-housing-perspective';
import { pickCouncilSpokenQuestion, runCouncilRound } from './lia-jarvis-council.engine';
import { runJarvisSimulation } from './lia-jarvis-simulation.engine';
import { pickChainQuestion } from './lia-jarvis-visual-chain';
import { synthesizeJarvisFromCouncil } from './lia-jarvis-voice-synthesis';

describe('lia-jarvis-voice-synthesis', () => {
  const title = 'Pas de réception TV';
  const description = 'Depuis hier, la TV affiche aucun signal.';

  function voiceForMessage(message: string) {
    let sim = runJarvisSimulation({
      title,
      description,
      preferredLanguage: 'fr',
    });
    sim = runJarvisSimulation({
      title,
      description,
      message,
      prior: sim,
      preferredLanguage: 'fr',
      housingKind: 'collective',
    });
    const housing = inferHousingPerspective('5F');
    const councilRound = runCouncilRound({
      title,
      description,
      message,
      state: {} as never,
      simulation: sim,
      housing,
      chainQuestion: pickChainQuestion(sim, 'fr'),
    });
    return synthesizeJarvisFromCouncil({
      name: 'Marie',
      lang: 'fr',
      message,
      title,
      description,
      housingKind: housing.kind,
      simulation: sim,
      councilRound,
      fallbackQuestion: pickCouncilSpokenQuestion(null, councilRound, sim.resolvedSteps),
    });
  }

  it('message TV seul — pas de compteur service, sonde voisins/communes', () => {
    const voice = voiceForMessage("bonjour j'ai plus de réception TV chez moi");
    expect(voice.acknowledgment).not.toMatch(/compteur|amplificateur|escalier/i);
    expect(voice.nextQuestion).toMatch(/voisin|communes/i);
  });

  it('message escalier — explication Savoir + clôture sans re-sonde', () => {
    const message =
      "je ne vais pas chez les gens, la lumière de l'escalier ne s'allume pas non plus";
    const voice = voiceForMessage(message);
    expect(voice.acknowledgment).toMatch(/compteur|amplificateur|parties communes/i);
    expect(voice.acknowledgment).toMatch(/transmets|électricien/i);
    expect(voice.nextQuestion).toBeNull();
  });
});
