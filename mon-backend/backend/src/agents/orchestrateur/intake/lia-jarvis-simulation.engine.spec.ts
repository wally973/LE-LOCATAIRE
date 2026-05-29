import { buildPostIntakeReply } from './lia-jarvis-dialogue.i18n';
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
        preferredLanguage: 'fr',
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
      expect(consult.acknowledgment).not.toMatch(/je visualise|en visualisant|mwen vizualiz/i);
      expect(consult.acknowledgment).toMatch(/porte|pòt/i);
      expect(consult.visualizationNote).toMatch(/visualis|affais|gond|accroch/i);
      expect(consult.nextQuestion).toMatch(/clé|clef|tourne|ferme|key/i);
      expect(consult.nextQuestion).not.toMatch(/pleut|pluie/i);
      expect(consult.language).toBe('fr');
    });

    it('« clé ne tourne pas » → clôture sans boucle', () => {
      let sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        preferredLanguage: 'fr',
      });
      sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        message: 'elle ne frotte pas, je n’arrive pas à tourner la clé',
        prior: sim,
        preferredLanguage: 'fr',
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
      });

      expect(sim.resolvedSteps).toContain('lock_focus');
      expect(sim.intakeComplete).toBe(true);
      expect(consult.nextQuestion).toBeNull();
      expect(consult.acknowledgment).toMatch(/serrurier|bailleur/i);
      expect(consult.acknowledgment).not.toMatch(/je visualise/i);
    });

    it('après clôture — « quand viennent-ils » → délai bailleur, pas répétition serrurier', () => {
      let sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        preferredLanguage: 'fr',
      });
      sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        message: 'elle ne frotte pas, je n’arrive pas à tourner la clé',
        prior: sim,
        preferredLanguage: 'fr',
      });
      const closing = buildJarvisConsultation({
        simulation: sim,
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
      });
      const followUp = buildJarvisConsultation({
        simulation: sim,
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
        postIntake: true,
        message: 'quand est-ce qu’ils vont venir ?',
      });

      expect(closing.acknowledgment).toMatch(/serrurier|bailleur/i);
      expect(followUp.acknowledgment).toMatch(/bailleur|recontacter|passage/i);
      expect(followUp.acknowledgment).not.toBe(closing.acknowledgment);
      expect(followUp.nextQuestion).toBeNull();
    });

    it('clôture serrurier à la première complétion (pas le message générique post-dossier)', () => {
      let sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        preferredLanguage: 'fr',
      });
      sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        message: 'oui je n’arrive pas à tourner la clés',
        prior: sim,
        preferredLanguage: 'fr',
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Porte qui ne ferme plus',
        description:
          'Ma porte d’entrée ne ferme plus correctement, la serrure accroche et le pêne ne rentre pas.',
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
        postIntake: false,
      });
      expect(consult.acknowledgment).toMatch(/serrurier|bailleur/i);
      expect(consult.acknowledgment).not.toMatch(/restez joignable, on revient vers vous/i);
    });

    it('post-dossier — urgence logement ouvert ≠ message précédent', () => {
      const closing = buildJarvisConsultation({
        simulation: {
          ...runJarvisSimulation({
            title: 'Porte',
            description: 'Porte serrure pêne',
          }),
          intakeComplete: true,
          resolvedSteps: ['lock_focus'],
        },
        title: 'Porte',
        description: 'Porte serrure pêne',
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
        postIntake: false,
      });
      const urgent = buildPostIntakeReply({
        message: 'c’est urgent le logement reste ouvert',
        name: 'Marie',
        lang: 'fr',
        domain: 'carpentry_door',
        lastAck: closing.acknowledgment,
      });
      expect(urgent).toMatch(/urgence|priorit|serrurier/i);
      expect(urgent).not.toBe(closing.acknowledgment);
    });

    it('réponses négatives gond/sol → intake complet sans répéter la question', () => {
      let sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description: 'Ma porte ne ferme plus, la serrure accroche.',
      });
      sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description: 'Ma porte ne ferme plus, la serrure accroche.',
        message: 'Non elle ne frotte pas en bas contre le sol',
        prior: sim,
      });
      expect(sim.resolvedSteps).toContain('hinge_vs_floor');
      expect(sim.intakeComplete).toBe(true);

      sim = runJarvisSimulation({
        title: 'Porte qui ne ferme plus',
        description: 'Ma porte ne ferme plus, la serrure accroche.',
        message: 'Non ça ne bloque pas en haut contre le cadre',
        prior: sim,
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Porte qui ne ferme plus',
        description: 'Ma porte ne ferme plus, la serrure accroche.',
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
      });
      expect(consult.nextQuestion).toBeNull();
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
        preferredLanguage: 'gcf',
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
      expect(consult.language).toBe('gcf');
      expect(consult.acknowledgment).not.toMatch(/mwen vizualiz/i);
      expect(consult.nextQuestion).toMatch(/moment|momant|permanence|ouvè|ouvrez|vidé/i);
    });

    it('« quand j’utilise l’évier » → question mitigeur vs évacuation', () => {
      let sim = runJarvisSimulation({
        title: 'Eau qui coule',
        description: 'Fuite sous l’évier depuis hier.',
        preferredLanguage: 'fr',
      });
      sim = runJarvisSimulation({
        title: 'Eau qui coule',
        description: 'Fuite sous l’évier depuis hier.',
        message: 'quand j’utilise l’évier',
        prior: sim,
        preferredLanguage: 'fr',
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
        preferredLanguage: 'fr',
      });
      sim = runJarvisSimulation({
        title: 'Fuite évier',
        description: 'Fuite sous l’évier.',
        message: 'quand j’utilise l’évier',
        prior: sim,
        preferredLanguage: 'fr',
      });
      sim = runJarvisSimulation({
        title: 'Fuite évier',
        description: 'Fuite sous l’évier.',
        message: 'c’est quand j’ouvre l’eau au mitigeur',
        prior: sim,
        preferredLanguage: 'fr',
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

  describe('Chaîne visuelle — sujet nouveau (ex. TV)', () => {
    it('reste générique et compare les hypothèses (pas de domaine TV codé)', () => {
      let sim = runJarvisSimulation({
        title: 'Signalement',
        description: 'Problème dans le logement.',
        preferredLanguage: 'fr',
      });
      expect(sim.domain).toBe('generic');

      sim = runJarvisSimulation({
        title: 'Signalement',
        description: 'Problème dans le logement.',
        message: 'sur la TV il affiche pas de réception',
        prior: sim,
        preferredLanguage: 'fr',
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Signalement',
        description: 'Problème dans le logement.',
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
      });

      expect(sim.domain).toBe('generic');
      expect(sim.activeFlows).toContain('signal');
      expect(sim.mentalModels.some((m) => /chaîne signal|amont/i.test(m))).toBe(true);
      expect(consult.nextQuestion).toMatch(/antenne|box|câble|prise|décodeur|endroit/i);
      expect(consult.nextQuestion).not.toMatch(/sans tout répéter|visualis|hésite entre|«/i);
    });

    it('preset TV : flux signal + hypothèses chaîne', () => {
      const sim = runJarvisSimulation({
        title: 'Pas de réception TV',
        description: 'La TV affiche aucun signal, je ne reçois plus les chaînes.',
        preferredLanguage: 'fr',
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Pas de réception TV',
        description: 'La TV affiche aucun signal, je ne reçois plus les chaînes.',
        tenantFirstName: 'Marie',
        mode: 'opening',
      });

      expect(sim.domain).toBe('generic');
      expect(sim.activeFlows).toContain('signal');
      expect(sim.hypotheses.some((h) => h.id.startsWith('chain_signal_'))).toBe(true);
      expect(consult.acknowledgment).toMatch(/réception télé|reception/i);
      expect(consult.acknowledgment).not.toMatch(/visualis|signalement/i);
      expect(consult.nextQuestion).toMatch(/antenne|box|câble|prise|endroit/i);
      expect(consult.nextQuestion).not.toMatch(/visualis|hésite entre|«/i);
    });
  });
});
