import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { BailleurScopeService } from './bailleur-scope.service';

/**
 * Guard à placer APRÈS `JwtAuthGuard` : résout la portée multi-tenant
 * (bailleur / agence / locataire) et l'expose via `request.bailleurScope`,
 * lisible avec le décorateur `@BailleurScope()`.
 *
 * Le guard ne bloque jamais l'accès en lui-même ; il enrichit la requête.
 * C'est aux services Prisma d'appliquer le filtre `landlordProfileId`.
 */
@Injectable()
export class BailleurScopeGuard implements CanActivate {
  constructor(private readonly scopeService: BailleurScopeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const jwtUser = request.user;

    if (!jwtUser) {
      throw new UnauthorizedException('Authentification requise');
    }

    request.bailleurScope = await this.scopeService.resolve(jwtUser);
    return true;
  }
}
