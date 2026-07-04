import { isConfirmedTopicChange } from './lia-jarvis-intake.engine';

describe('isConfirmedTopicChange', () => {
  it('ne déclenche pas un faux changement de sujet électricité sur mention disjoncteur', () => {
    const title = "d'un coup j'ai pas de courant dans les prise de la cuisine";
    const description = title;

    expect(
      isConfirmedTopicChange(
        'undisjoncteur est vers le bas',
        title,
        description,
        'ELECTRICITY',
      ),
    ).toBe(false);
  });
});
