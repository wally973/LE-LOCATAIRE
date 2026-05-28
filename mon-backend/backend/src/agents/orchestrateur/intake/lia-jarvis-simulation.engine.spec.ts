import {
  buildJarvisConsultation,
  runJarvisSimulation,
} from './lia-jarvis-simulation.engine';

describe('lia-jarvis-simulation.engine — tests de vérité Marie', () => {
  describe('Porte — gâche / ne ferme plus', () => {
    it('ouverture : visualise gonds affaissés ou sol qui gonfle + question physique', () => {
      const sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        tenantFirstName: 'Marie',
        mode: 'opening',
      });

      expect(sim.domain).toBe('carpentry_door');
      expect(sim.hypotheses.some((h) => h.id === 'hinge_sag' && h.active)).toBe(true);
      expect(consult.acknowledgment).toMatch(/visualis/i);
      expect(consult.acknowledgment).toMatch(/affais|gonfl|gond|accroch/i);
      expect(consult.nextQuestion).toMatch(/sol|cadre|frotte|bloque/i);
      expect(consult.nextQuestion).not.toMatch(/pleut|pluie/i);
    });

    it('réponse « frotte en bas » → intake complet, simulation tranchée', () => {
      let sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description: 'Ma porte ne ferme plus, la serrure accroche.',
      });
      sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description: 'Ma porte ne ferme plus, la serrure accroche.',
        message: 'Elle frotte en bas contre le sol',
        prior: sim,
      });
      expect(sim.resolvedSteps).toContain('hinge_vs_floor');
      expect(sim.intakeComplete).toBe(true);
    });
  });

  describe('Évier — fuite sous l’évier', () => {
    it('ouverture : reformule sous l’évier, pas la pluie en premier', () => {
      const sim = runJarvisSimulation({
        title: 'Fuite sous l’évier',
        description: 'Bonjou, dlo ap koule anpil sou lavabo la.',
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Fuite sous l’évier',
        description: 'Bonjou, dlo ap koule anpil sou lavabo la.',
        tenantFirstName: 'Marie',
        mode: 'opening',
      });

      expect(sim.domain).toBe('plumbing_sink');
      expect(sim.hypotheses.find((h) => h.id === 'roof_infiltration')?.active).toBeFalsy();
      expect(consult.nextQuestion).toMatch(/moment|momant|permanence|ouvrez|ouvè|vidé/i);
      expect(consult.nextQuestion).not.toMatch(/pleut|pluie/i);
      expect(consult.acknowledgment).toMatch(/visualis|vizualiz/i);
    });

    it('« quand j’utilise l’évier » → question mitigeur vs évacuation', () => {
      let sim = runJarvisSimulation({
        title: 'Eau qui coule',
        description: 'Fuite sous l’évier depuis hier.',
      });
      sim = runJarvisSimulation({
        title: 'Eau qui coule',
        description: 'Fuite sous l’évier depuis hier.',
        message: 'quand j’utilise l’évier',
        prior: sim,
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Eau qui coule',
        description: 'Fuite sous l’évier depuis hier.',
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
      });

      expect(sim.resolvedSteps).toContain('timing');
      expect(consult.nextQuestion).toMatch(/mitigeur|ouvrez|évacuation|vidé/i);
      expect(consult.nextQuestion).not.toMatch(/pleut/i);
    });

    it('« quand j’ouvre l’eau » → test du bouchon', () => {
      let sim = runJarvisSimulation({
        title: 'Fuite évier',
        description: 'Fuite sous l’évier.',
      });
      sim = runJarvisSimulation({
        title: 'Fuite évier',
        description: 'Fuite sous l’évier.',
        message: 'quand j’utilise l’évier',
        prior: sim,
      });
      sim = runJarvisSimulation({
        title: 'Fuite évier',
        description: 'Fuite sous l’évier.',
        message: 'c’est quand j’ouvre l’eau au mitigeur',
        prior: sim,
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Fuite évier',
        description: 'Fuite sous l’évier.',
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
      });

      expect(sim.resolvedSteps).toContain('supply_vs_drain');
      expect(consult.nextQuestion).toMatch(/bouchon/i);
    });
  });
});
