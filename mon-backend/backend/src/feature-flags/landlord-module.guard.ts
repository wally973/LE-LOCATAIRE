import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { BailleurScope } from '../auth/scope/bailleur-scope.types';
import { FeatureFlagsService } from './feature-flags.service';
import type { LandlordModuleKey } from './feature-flags.types';

export const LANDLORD_MODULE_KEY = 'landlordModuleKey';

export const RequiresLandlordModule = (key: LandlordModuleKey) =>
  SetMetadata(LANDLORD_MODULE_KEY, key);

/**
 * Bloque l'accès si le module n'est pas activé pour le bailleur concerné.
 * Placer après JwtAuthGuard ; idéalement après BailleurScopeGuard si présent.
 * Les ADMIN plateforme ne sont pas filtrés (isAdmin).
 */
@Injectable()
export class LandlordModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<
      LandlordModuleKey | undefined
    >(LANDLORD_MODULE_KEY, [context.getHandler(), context.getClass()]);
    if (!moduleKey) return true;

    const req = context.switchToHttp().getRequest();
    const scope = req.bailleurScope as BailleurScope | undefined;

    if (scope?.isAdmin) return true;

    if (scope?.landlordProfileId) {
      await this.featureFlags.assertModuleEnabled(
        scope.landlordProfileId,
        moduleKey,
      );
      return true;
    }

    const jwtUser = req.user as { userId?: number; role?: string } | undefined;
    if (!jwtUser?.userId) return false;

    if (jwtUser.role === 'LOCATAIRE') {
      await this.featureFlags.assertModuleEnabledForTenantUser(
        jwtUser.userId,
        moduleKey,
      );
      return true;
    }

    await this.featureFlags.assertModuleEnabledForUser(
      jwtUser.userId,
      moduleKey,
    );
    return true;
  }
}
