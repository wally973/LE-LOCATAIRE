import { MaintenanceContractMapperService } from './maintenance-contract-mapper.service';
import { loadMaintenanceContracts } from './maintenance-contracts.loader';

describe('MaintenanceContractMapperService', () => {
  const mapper = new MaintenanceContractMapperService();

  beforeAll(() => {
    loadMaintenanceContracts();
  });

  it('mappe hyp_common_elevator → MP-GUYANE-ASCENSEUR-SCHINDLER-2024', () => {
    const match = mapper.resolveByHypothesisId('hyp_common_elevator');
    expect(match).not.toBeNull();
    expect(match!.contractId).toBe('MP-GUYANE-ASCENSEUR-SCHINDLER-2024');
    expect(match!.contract.supplier).toContain('SCHINDLER');
    expect(match!.contract.lot).toBe('LOT-07-ASCENSEUR');
  });

  it('extrait leadingHypothesisId depuis aiLastDecision.diagnostic', () => {
    const id = mapper.extractLeadingHypothesisId({
      diagnostic: { leadingHypothesisId: 'hyp_common_elevator' },
    });
    expect(id).toBe('hyp_common_elevator');
  });

  it('résout depuis aiLastDecision complet (ascenseur bloqué)', () => {
    const match = mapper.resolveForTicketAiDecision(
      {
        diagnostic: {
          leadingHypothesisId: 'hyp_common_elevator',
          domain: 'COMMON_AREAS',
        },
      },
      {
        category: 'COMMON_AREAS',
        contextText: 'Ascenseur bloqué au 3e étage',
        urgent: true,
      },
    );
    expect(match?.contractId).toBe('MP-GUYANE-ASCENSEUR-SCHINDLER-2024');
    expect(match?.urgent).toBe(true);
    const brief = mapper.formatBrief(match!);
    expect(brief).toContain('ContractID : MP-GUYANE-ASCENSEUR-SCHINDLER-2024');
    expect(brief).toContain('Délai intervention cible : 4 h');
    expect(brief).toContain('ASC-DEP');
  });

  it('repli électricité grésillante via mots-clés', () => {
    const match = mapper.resolveByContext(
      'Prise qui grésille dans le couloir parties communes',
      'ELECTRICITY',
    );
    expect(match?.contractId).toBe('MP-GUYANE-ELECTRICITE-EDF-SOLAIRE-2023');
    expect(match?.contract.lot).toBe('LOT-03-ELECTRICITE');
  });
});
