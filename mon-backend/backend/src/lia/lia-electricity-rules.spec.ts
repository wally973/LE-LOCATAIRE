import {
  parseElectricitySignals,
  resolveElectricityCharge,
  buildElectricityJuristHint,
} from './lia-electricity-rules';
import { buildIntakeSummary, type LiaIntakeState } from './lia-intake.service';

describe('parseElectricitySignals / resolveElectricityCharge', () => {
  it('coupure générale → bailleur', () => {
    const text =
      'plus de courant dans tout le logement disjoncteur general deja verifie';
    const s = parseElectricitySignals(text);
    expect(s.generalOutage).toBe(true);
    expect(resolveElectricityCharge(s)).toBe('BAILLEUR');
  });

  it('SDB ampoule changée + interrupteur HS → locataire', () => {
    const text = normalize(`
      lumiere salle de bain
      ampoule deja changee
      interrupteur → non il ne marche pas
    `);
    const s = parseElectricitySignals(text);
    expect(s.localizedLighting).toBe(true);
    expect(s.bulbAlreadyChanged).toBe(true);
    expect(s.switchWorks).toBe(false);
    expect(resolveElectricityCharge(s)).toBe('LOCATAIRE');
  });

  it('ampoule changée + disjoncteur circuit ne tient pas → bailleur', () => {
    const text = normalize(`
      eclairage localise une seule piece
      ampoule remplacee
      disjoncteur circuit → non reste declenche
    `);
    const s = parseElectricitySignals(text);
    expect(resolveElectricityCharge(s)).toBe('BAILLEUR');
  });

  it('ampoule changée, interrupteur et disjoncteur OK, pas de douille → escalade', () => {
    const text = normalize(`
      lumiere salle de bain
      ampoule changee
      interrupteur → oui fonctionne
      disjoncteur → oui enclenche
      douille → non pas d usure
    `);
    const s = parseElectricitySignals(text);
    expect(resolveElectricityCharge(s)).toBe('ESCALADE_BAILLEUR');
  });

  it('éclairage localisé sans ampoule changée → locataire (menue réparation)', () => {
    const text = 'lumiere ne marche plus dans la chambre';
    const s = parseElectricitySignals(text);
    expect(s.localizedLighting).toBe(true);
    expect(s.bulbAlreadyChanged).toBe(false);
    expect(resolveElectricityCharge(s)).toBe('LOCATAIRE');
  });
});

describe('buildIntakeSummary + orientation juriste', () => {
  const lightingState: LiaIntakeState = {
    phase: 'AWAITING_PHOTO',
    category: 'ELECTRICITY',
    currentQuestionIndex: 4,
    answers: {
      bulb_action: 'Oui, ampoule neuve déjà posée',
      scope: 'Éclairage localisé (une pièce)',
      switch_ok: 'Non, l’interrupteur ne réagit pas',
      room_breaker: 'Oui, disjoncteur du circuit enclenché',
      socket_check: 'Non, rien de visible',
    },
    signals: { roomHint: 'salle de bain' },
  };

  it('résumé intake contient les réponses et une orientation', () => {
    const summary = buildIntakeSummary(lightingState);
    expect(summary).toContain('interrupteur');
    expect(summary).toContain('disjoncteur');
    expect(summary).toMatch(/orientation juriste/i);
    expect(buildElectricityJuristHint(lightingState.answers)).toMatch(
      /locataire|réparation locative/i,
    );
  });
});

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
