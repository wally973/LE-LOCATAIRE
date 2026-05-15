import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Clé de requête pour le contexte référent social (Sprint 5 P1). */
export const REQUEST_SOCIAL_WORKER = 'socialWorkerContext';

/**
 * Guard : accès réservé aux utilisateurs présents dans la table SocialWorker.
 * Attache l'enregistrement complet sur `request[REQUEST_SOCIAL_WORKER]`.
 */
@Injectable()
export class SocialWorkerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id ?? request.user?.userId;
    if (!userId) {
      throw new ForbiddenException('Authentification requise');
    }

    const sw = await this.prisma.socialWorker.findFirst({
      where: { userId },
      orderBy: { id: 'asc' },
      include: { bailleur: { select: { id: true, name: true } } },
    });
    if (!sw) {
      throw new ForbiddenException(
        'Accès réservé aux référents sociaux enregistrés par le bailleur.',
      );
    }

    request[REQUEST_SOCIAL_WORKER] = sw;
    return true;
  }
}
