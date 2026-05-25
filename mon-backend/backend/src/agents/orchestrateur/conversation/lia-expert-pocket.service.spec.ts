import { LiaExpertPocketService } from './lia-expert-pocket.service';
import { LiaHostService } from './lia-host.service';
import { LiaIntakeService } from '../intake/lia-intake.service';

describe('LiaExpertPocketService', () => {
  const host = { chatStructured: async () => null } as unknown as LiaHostService;
  const pocket = new LiaExpertPocketService(host);
  const intakeService = new LiaIntakeService();

  it('répond en créole sur le test Miroir (urgence évier)', async () => {
    let state = intakeService.createInitialState(
      'Plomberie',
      'dlo anba lavabo depi m antre',
    );
    const reply = await pocket.buildReply({
      tenantFirstName: 'Marie',
      title: 'Plomberie',
      description: 'dlo anba lavabo depi m antre',
      message: 'Mwen mete yon bokit men dlo a anpil, fè vit.',
      state,
    });
    expect(reply.language).toBe('gcf');
    expect(reply.text.toLowerCase()).toMatch(/bokit|bailleur|dlo/);
    expect(reply.uiStatus?.kind).toMatch(/HANDOFF_BAILLEUR|ALERT_LANDLORD/);
  });

  it('phrase Marie évier en français', () => {
    const state = intakeService.createInitialState(
      'Fuite évier',
      'Je viens d’emménager, l’évier fuit dessous, seau en place',
    );
    const opening = pocket.buildOpeningAck({
      tenantFirstName: 'Marie',
      title: state.intakeTitle!,
      description: state.intakeDescription!,
      state,
    });
    expect(opening?.language).toBe('fr');
    expect(opening?.text).toContain('évier');
    expect(opening?.text).toContain('seau');
    expect(opening?.uiStatus?.label).toContain('bailleur');
  });
});
