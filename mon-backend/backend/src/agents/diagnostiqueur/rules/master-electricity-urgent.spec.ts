/**
 * Démonstration expansion Savoir-Voir — prise qui grésille et sent le brûlé.
 */
import { loadMasterDiagnosticRules } from '../../chercheur/knowledge/master-diagnostic-rules.loader';
import {
  detectMasterDomain,
  detectMasterUrgentDanger,
  runMasterDifferential,
} from './master-diagnostic-engine';
import { applyUrgentCriticalOverlay } from '../../shared/critical-safety-protocol';
import { resolveLegalBasisForVerdict } from './lia-legal-basis';
import { LiaJuristService } from '../../../ai-routing/agents/lia-jurist.service';
import type { PathologistResult } from '../../../ai-routing/agents/pathologist.types';

describe('Expansion Savoir-Voir — prise grésille + odeur brûlé', () => {
  beforeAll(() => {
    loadMasterDiagnosticRules();
  });

  const signalement =
    'Prise électrique qui grésille et sent le brûlé dans le salon';

  it('détecte le domaine Électricité et l’urgence', () => {
    const domain = detectMasterDomain(signalement);
    expect(domain?.id).toBe('ELECTRICITY');

    const urgent = detectMasterUrgentDanger(signalement, domain);
    expect(urgent.urgent).toBe(true);
    expect(urgent.domainId).toBe('ELECTRICITY');
  });

  it('élimine les hypothèses locatives et retient installation dangereuse', () => {
    const domain = detectMasterDomain(signalement)!;
    const diff = runMasterDifferential({
      domain,
      contextText: signalement,
      sensors: {
        electric_scope: 'localisé (une pièce / une prise)',
        danger_signs: 'grésillement / odeur de brûlé / étincelles',
      },
    });

    expect(diff.leadingHypothesisId).toBe('hyp_elec_installation_defect');
    expect(diff.responsibilityHint).toBe('BAILLEUR');
    const bulb = diff.hypotheses.find((h) => h.id === 'hyp_elec_tenant_bulb');
    expect(bulb?.eliminated).toBe(true);
  });

  it('produit URGENT_CRITIQUE + charge bailleur (juriste + overlay)', async () => {
    const patho: PathologistResult = {
      category: 'ELECTRICITY',
      severity: 'HIGH',
      confidence: 0.85,
      needsMorePhoto: false,
      observation: 'Prise avec signes de surchauffe.',
      fromLlm: false,
    };
    const jurist = new LiaJuristService({} as never);
    const base = await jurist.decide({
      input: {
        title: 'Prise salon',
        description: signalement,
        attempt: 1,
        photoUrls: [],
        locale: 'fr-FR',
        caseContextForRules: signalement,
      },
      pathologist: patho,
      memories: [],
    });

    expect(base.responsibility).toBe('BAILLEUR');

    const final = applyUrgentCriticalOverlay(base, signalement);
    expect(final.severity).toBe('URGENT_CRITIQUE');
    expect(final.responsibility).toBe('BAILLEUR');
    expect(final.message).toMatch(/Coupez le disjoncteur|N.?utilisez plus cette prise/i);

    const legal = resolveLegalBasisForVerdict({
      responsibility: 'BAILLEUR',
      category: 'ELECTRICITY',
    });
    expect(legal).toMatch(/1719/);
  });
});
