import { inferHousingPerspective } from './lia-housing-perspective';
import { buildPostIntakeReply } from './lia-jarvis-dialogue.i18n';
import {
  pickCouncilSpokenQuestion,
  runCouncilRound,
} from './lia-jarvis-council.engine';
import {
  buildJarvisConsultation,
  runJarvisSimulation,
} from './lia-jarvis-simulation.engine';
import { extractPlumbingBackupLead } from './lia-tenant-signalement-facts';
import { pickChainQuestion } from './lia-jarvis-visual-chain';
import { synthesizeJarvisFromCouncil } from './lia-jarvis-voice-synthesis';

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

    it('porte chambre bloquée + enfant dedans — lecture exacte + question poignée', () => {
      const title = 'logement';
      const description =
        'Bonjour, la porte de la chambre de mon fils est bloqué, il est dans la chambre';

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

      expect(sim.domain).toBe('carpentry_door');
      expect(sim.scene.room).toBe('chambre');
      expect(sim.scene.symptomAnchor).toMatch(/bloquée.*personne|personne.*pièce/i);
      expect(sim.tenantFacts?.safetyUrgent).toBe(true);
      expect(sim.tenantFacts?.mechanicalDoorIssue).toBe(true);
      expect(sim.hypotheses.find((h) => h.id === 'lock_misalign')?.active).toBe(true);
      expect(sim.hypotheses.find((h) => h.id === 'hinge_sag')?.active).toBe(false);
      expect(sim.mentalModels.some((m) => /urgence|serrurier/i.test(m))).toBe(true);
      expect(consult.acknowledgment).toMatch(/j.?ai lu votre signalement/i);
      expect(consult.acknowledgment).toMatch(/bloqu|enfant|fils|chambre/i);
      expect(consult.acknowledgment).toMatch(/urgent|priorit|serrurier/i);
      expect(consult.acknowledgment).not.toMatch(/ne ferme plus correctement/i);
      expect(consult.nextQuestion).toMatch(/serrurier|poignée|intérieur/i);
      expect(consult.intakeComplete).toBe(false);
    });

    it('document madame Pascal — une bulle admin, pas question technique', () => {
      const title = 'logement';
      const description =
        "Bonjour, j'ai un document à remettre à madame Pascal, travail t-elle aujourd'hui";

      const sim = runJarvisSimulation({
        title,
        description,
        preferredLanguage: 'fr',
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title,
        description,
        tenantFirstName: 'Marie',
        mode: 'opening',
      });

      expect(sim.tenantFacts?.administrativeLead).toBe(true);
      expect(sim.intakeComplete).toBe(true);
      expect(consult.intakeComplete).toBe(true);
      expect(consult.nextQuestion).toBeNull();
      expect(consult.acknowledgment).toMatch(/document|madame|Pascal/i);
      expect(consult.acknowledgment).toMatch(/gérance|agence|secteur/i);
      expect(consult.acknowledgment).not.toMatch(/préciser ce que vous observez/i);
    });

    it('évier cuisine inondé eau sale urgent — une bulle refoulement, pas question sous évier', () => {
      const title = 'logement évier cuisine';
      const description =
        "bonjour, c'est urgent mon évier est rempli d'une eau sale et ma cuisine est inonder";

      const sim = runJarvisSimulation({
        title,
        description,
        preferredLanguage: 'fr',
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title,
        description,
        tenantFirstName: 'Marie',
        mode: 'opening',
      });

      expect(sim.domain).toBe('plumbing_sink');
      expect(sim.tenantFacts?.plumbingBackupLead).toBe(true);
      expect(sim.tenantFacts?.plumbingEuRefoulementLead).toBe(true);
      expect(sim.intakeComplete).toBe(true);
      expect(consult.intakeComplete).toBe(true);
      expect(consult.nextQuestion).toBeNull();
      expect(consult.acknowledgment).toMatch(/c.?est urgent|urgent/i);
      expect(consult.acknowledgment).toMatch(/évier.*plein.*eau sale|cuisine.*inond/i);
      expect(consult.acknowledgment).toMatch(/hydrocur|colonne|eaux usées|refoulement/i);
      expect(consult.acknowledgment).not.toMatch(/je vous entends|fuite d.?eau au point d.?eau/i);
      expect(sim.hypotheses.some((h) => h.id === 'eu_refoulement_column' && h.active)).toBe(
        true,
      );
      expect(sim.scene.below).toMatch(/colonne|descente/i);
      expect(sim.scene.above).toMatch(/dessus|collectif/i);
      expect(sim.mentalModels.some((m) => /3 verres|exutoire/i.test(m))).toBe(true);
    });

    it('réclamation dans le titre seul — refoulement détecté', () => {
      const title =
        "bonjour, c'est urgent mon évier est rempli d'une eau sale et ma cuisine est inonder";
      const description = '';

      const sim = runJarvisSimulation({ title, description, preferredLanguage: 'fr' });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title,
        description,
        tenantFirstName: 'Marie',
        mode: 'opening',
      });

      expect(extractPlumbingBackupLead(`${title} ${description}`)).toBe(true);
      expect(consult.nextQuestion).toBeNull();
      expect(consult.acknowledgment).toMatch(/eau sale|inond/i);
      expect(consult.acknowledgment).not.toMatch(/fuite d.?eau au point d.?eau/i);
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
      expect(followUp.acknowledgment).toMatch(/comprends|serrurier|bailleur/i);
      expect(followUp.acknowledgment).not.toBe(closing.acknowledgment);
      expect(followUp.nextQuestion).toBeNull();
    });

    it('hall insalubre — écoute : pas de question logement ni TV après précision communs', () => {
      let sim = runJarvisSimulation({
        title: 'Hall sale et odeurs',
        description:
          'Le hall de l’immeuble est sale, ça sent les poubelles et plusieurs locataires ont déjà écrit sans réponse.',
        preferredLanguage: 'fr',
      });
      expect(sim.tenantFacts?.commonsSalubrityLead).toBe(true);
      expect(sim.intakeComplete).toBe(true);

      sim = runJarvisSimulation({
        title: 'Hall sale et odeurs',
        description: 'Le hall est insalubre.',
        message:
          'Surtout le hall et la cage d’escalier. Mon appartement est propre, c’est vraiment les parties communes.',
        prior: runJarvisSimulation({
          title: 'Hall sale et odeurs',
          description: 'Le hall est insalubre.',
          preferredLanguage: 'fr',
        }),
        preferredLanguage: 'fr',
      });
      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Hall sale et odeurs',
        description: 'Le hall est insalubre.',
        tenantFirstName: 'Marie',
        mode: 'tenant_turn',
        message:
          'Surtout le hall et la cage d’escalier. Mon appartement est propre, c’est vraiment les parties communes.',
      });
      expect(consult.acknowledgment).toMatch(/j.?ai lu|salubrit|hall|escalier/i);
      expect(consult.nextQuestion).toBeNull();
      expect(consult.intakeComplete).toBe(true);
    });

    it('« hall et escalier sale » — clôture à l’ouverture, pas de marche abîmée', () => {
      const sim = runJarvisSimulation({
        title: 'Hall et escalier sale',
        description:
          'Le hall et l’escalier ne sont plus nettoyés, c’est sale depuis plusieurs semaines.',
        preferredLanguage: 'fr',
        housingKind: 'collective',
      });
      expect(sim.tenantFacts?.commonsSalubrityLead).toBe(true);
      expect(sim.intakeComplete).toBe(true);

      const consult = buildJarvisConsultation({
        simulation: sim,
        title: 'Hall et escalier sale',
        description:
          'Le hall et l’escalier ne sont plus nettoyés, c’est sale depuis plusieurs semaines.',
        tenantFirstName: 'Marie',
        mode: 'opening',
      });
      expect(consult.nextQuestion).toBeNull();
      expect(consult.acknowledgment).toMatch(/j.?ai lu|lu votre signalement|salubrit/i);
      expect(consult.acknowledgment).toMatch(/ménage|prestataire|transmets/i);
      expect(consult.acknowledgment).not.toMatch(/marche abîmée|niveau de l.?escalier/i);
    });

    it('post-dossier hall insalubre — délai = relance prestataire ménage', () => {
      const reply = buildPostIntakeReply({
        message: 'quand est-ce qu’ils comptent réagir ?',
        name: 'Marie',
        lang: 'fr',
        domain: 'generic',
        title: 'Hall sale et odeurs',
        description:
          'Le hall de l’immeuble est sale, ça sent les poubelles et plusieurs locataires ont déjà écrit sans réponse.',
      });
      expect(reply).toMatch(/comprends|prestataire|ménage|parties communes/i);
      expect(reply).toMatch(/hall|escalier/i);
      expect(reply).toMatch(/comptent réagir|quand est-ce/i);
      expect(reply).toMatch(/relancer/i);
      expect(reply).not.toMatch(/serrurier/i);
    });

    it('post-dossier — correction « pas besoin de serrurier » sur hall sale', () => {
      const reply = buildPostIntakeReply({
        message: 'un serrurier mais j’en ai pas besoin',
        name: 'Marie',
        lang: 'fr',
        domain: 'generic',
        title: 'Hall sale et odeurs',
        description: 'Le hall est sale, odeur de poubelles.',
        lastAck:
          'Marie, le bailleur organise l’intervention — un serrurier vous recontactera.',
      });
      expect(reply).toMatch(/raison|corrige|salubrit|ménage|hall/i);
      expect(reply).not.toMatch(/serrurier vous recontactera/i);
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

    it('réponse escalier — lien compteur service et clôture (voix Savoir)', () => {
      const title = 'Pas de réception TV';
      const description = 'Depuis hier, la TV affiche aucun signal.';
      const message =
        "mon voisin est absent, justement on a un souci d'éclairage dans l'escalier";

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

      const voice = synthesizeJarvisFromCouncil({
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

      expect(sim.resolvedSteps).toContain('savoir_collective');
      expect(sim.resolvedSteps).toContain('service_meter_link');
      expect(sim.intakeComplete).toBe(true);
      expect(voice.acknowledgment).toMatch(/compteur|amplificateur|parties communes/i);
      expect(voice.acknowledgment).toMatch(/transmets|électricien/i);
      expect(voice.acknowledgment).not.toMatch(
        /intégré à la scène|tout le logement.*seulement/i,
      );
      expect(voice.nextQuestion).toBeNull();
    });

    it('correction portail vs boîte aux lettres — ack sujet + sonde portail, pas mailbox', () => {
      const title = 'Boîte aux lettres bloquée';
      const description =
        'Ma boîte aux lettres ne s’ouvre plus bien. La clé tourne difficilement.';
      const message = 'je vous parle de portail';

      let sim = runJarvisSimulation({
        title,
        description,
        preferredLanguage: 'fr',
        housingKind: 'collective',
      });
      sim = runJarvisSimulation({
        title,
        description,
        message,
        prior: sim,
        preferredLanguage: 'fr',
        housingKind: 'collective',
      });

      expect(sim.tenantFacts?.subjectCorrected).toBe(true);
      expect(sim.intakeComplete).toBe(false);

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

      const voice = synthesizeJarvisFromCouncil({
        name: 'Marie',
        lang: 'fr',
        message,
        title,
        description,
        housingKind: housing.kind,
        simulation: sim,
        councilRound,
        fallbackQuestion: pickCouncilSpokenQuestion(
          null,
          councilRound,
          sim.resolvedSteps,
          sim.tenantFacts,
        ),
      });

      expect(voice.acknowledgment).toMatch(/portail|pòtay/i);
      expect(voice.acknowledgment).not.toMatch(/merci pour cette précision/i);
      expect(voice.nextQuestion).toMatch(/portail|moteur/i);
      expect(voice.nextQuestion).not.toMatch(/boîte aux lettres|couvercle/i);
    });
  });
});
