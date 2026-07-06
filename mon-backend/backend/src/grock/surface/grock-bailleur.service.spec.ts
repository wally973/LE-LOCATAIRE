import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GrockBailleurService } from './grock-bailleur.service';

describe('GrockBailleurService', () => {
  it('refuse un ticket hors périmètre bailleur', async () => {
    const prisma = {
      landlordProfile: {
        findFirst: async () => ({ id: 10 }),
      },
      ticket: {
        findFirst: async () => null,
      },
    };
    const grock = { runTurn: jest.fn() };
    const svc = new GrockBailleurService(grock as never, prisma as never);

    await expect(
      svc.converseOnTicket(1, { ticketId: 99, message: 'Synthèse dossier ?' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('appelle Grock en interlocuteur landlord', async () => {
    const prisma = {
      landlordProfile: {
        findFirst: async () => ({ id: 10 }),
      },
      ticket: {
        findFirst: async () => ({
          id: 5,
          caseNumber: 'AFF-2026-000005',
          title: 'Fuite',
          description: 'ECS',
          status: 'OPEN',
          responsibility: 'BAILLEUR',
          aiConfidence: 0.8,
          aiCategory: null,
          aiSeverity: null,
          housing: { address: '12 rue Démo', city: 'Cayenne', postalCode: '97300' },
        }),
      },
    };
    const grock = {
      runTurn: jest.fn().mockResolvedValue({
        reply: 'Synthèse',
        interlocutor: 'landlord',
        scores: { signalQuality: 7 },
        preprocessedSignal: { signalQuality: 7 },
      }),
    };
    const svc = new GrockBailleurService(grock as never, prisma as never);

    await svc.converseOnTicket(1, { ticketId: 5, message: 'Quelle charge ?' });

    expect(grock.runTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        interlocutor: 'landlord',
        ticketId: 5,
        landlordContext: expect.stringContaining('AFF-2026-000005'),
      }),
    );
  });

  it('refuse sans profil bailleur', async () => {
    const prisma = {
      landlordProfile: { findFirst: async () => null },
    };
    const svc = new GrockBailleurService({ runTurn: jest.fn() } as never, prisma as never);
    await expect(
      svc.converseOnTicket(1, { ticketId: 1, message: 'test' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
