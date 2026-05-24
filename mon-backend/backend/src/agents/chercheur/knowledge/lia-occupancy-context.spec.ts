import {
  POST_HANDOVER_REPAIR_WINDOW_MONTHS,
  isPostHandoverBailleurDefect,
  parseOccupancyContext,
} from './lia-occupancy-context';

describe('parseOccupancyContext', () => {
  it('fenêtre 6 mois + menues réparations remise en état', () => {
    const ctx = parseOccupancyContext(
      'depuis 4 mois entree menues reparations pas bien faites a la remise en etat',
    );
    expect(ctx.monthsSinceMoveIn).toBe(4);
    expect(ctx.withinSixMonthsOfMoveIn).toBe(true);
    expect(ctx.smallRepairsMissedAtHandover).toBe(true);
    expect(isPostHandoverBailleurDefect(ctx)).toBe(true);
  });

  it('remise en état neuve + GPA', () => {
    const ctx = parseOccupancyContext(
      'logement neuf remise en etat GPA encore en cours panne depuis entree',
    );
    expect(ctx.mentionsNewHandover).toBe(true);
    expect(ctx.mentionsGpa).toBe(true);
    expect(isPostHandoverBailleurDefect(ctx)).toBe(true);
  });

  it('constante fenêtre 6 mois documentée', () => {
    expect(POST_HANDOVER_REPAIR_WINDOW_MONTHS).toBe(6);
  });
});
