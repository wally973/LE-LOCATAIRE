import { inferHousingPerspective } from './lia-housing-perspective';
import {
  isGenericFallbackQuestion,
  pickCouncilSpokenQuestion,
  runCouncilRound,
} from './lia-jarvis-council.engine';
import { pickChainQuestion } from './lia-jarvis-visual-chain';
import { runJarvisSimulation } from './lia-jarvis-simulation.engine';
import type { LiaIntakeState } from './lia-intake.service';

const emptyState = {} as LiaIntakeState;

describe('lia-jarvis-council.engine — écho chauve-souris', () => {
  it('TV + lot 5F → Savoir collectif propose voisins / communes', () => {
    const sim = runJarvisSimulation({
      title: 'Pas de réception TV',
      description: 'Depuis hier, la TV affiche aucun signal.',
      preferredLanguage: 'fr',
    });
    const housing = inferHousingPerspective('5F');
    const chainQuestion = pickChainQuestion(sim, 'fr');
    const round = runCouncilRound({
      title: 'Pas de réception TV',
      description: 'Depuis hier, la TV affiche aucun signal.',
      message: '',
      state: emptyState,
      simulation: sim,
      housing,
      chainQuestion,
    });

    const savoir = round.echoes.find((e) => e.agent === 'savoir');
    expect(savoir).toBeDefined();
    expect(savoir!.suggestedQuestion).toMatch(/voisin|communes|éclairage/i);
    expect(round.echoes.some((e) => e.agent === 'visual')).toBe(true);
  });

  it('TV + lot 26 → Savoir standalone (poste local)', () => {
    const sim = runJarvisSimulation({
      title: 'Pas de réception TV',
      description: 'Depuis hier, aucun signal TV.',
      preferredLanguage: 'fr',
    });
    const housing = inferHousingPerspective('26');
    const round = runCouncilRound({
      title: 'Pas de réception TV',
      description: 'Depuis hier, aucun signal TV.',
      message: '',
      state: emptyState,
      simulation: sim,
      housing,
      chainQuestion: pickChainQuestion(sim, 'fr'),
    });

    const savoir = round.echoes.find((e) => e.agent === 'savoir');
    expect(savoir?.suggestedQuestion).toMatch(/poste|TV|autre/i);
  });

  it('pickCouncilSpokenQuestion préfère Savoir aux questions « visualisation »', () => {
    const sim = runJarvisSimulation({
      title: 'Pas de réception TV',
      description: 'Depuis hier, aucun signal.',
      preferredLanguage: 'fr',
    });
    const round = runCouncilRound({
      title: 'Pas de réception TV',
      description: 'Depuis hier, aucun signal.',
      message: '',
      state: emptyState,
      simulation: sim,
      housing: inferHousingPerspective('5F'),
      chainQuestion: pickChainQuestion(sim, 'fr'),
    });

    const meta =
      'En visualisant votre logement, je hésite entre deux pistes : plutôt « Amont », ou plutôt « Logement » ?';
    const spoken = pickCouncilSpokenQuestion(meta, round);
    expect(spoken).toMatch(/voisin|communes|éclairage/i);
    expect(spoken).not.toMatch(/visualis|hésite entre|«/i);
  });

  it('pickCouncilSpokenQuestion évite la question générique en boucle', () => {
    const sim = runJarvisSimulation({
      title: 'Pas de réception TV',
      description: 'Depuis hier, aucun signal.',
      preferredLanguage: 'fr',
    });
    const round = runCouncilRound({
      title: 'Pas de réception TV',
      description: 'Depuis hier, aucun signal.',
      message: '',
      state: emptyState,
      simulation: sim,
      housing: inferHousingPerspective('5F'),
      chainQuestion: pickChainQuestion(sim, 'fr'),
    });

    const generic = 'Pouvez-vous préciser ce que vous observez, sans tout répéter ?';
    expect(isGenericFallbackQuestion(generic)).toBe(true);
    const spoken = pickCouncilSpokenQuestion(generic, round);
    expect(spoken).not.toMatch(/sans tout répéter/i);
    expect(spoken).toMatch(/voisin|communes|éclairage/i);
  });
});
