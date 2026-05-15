import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from './feature-flags.service';
import type { LandlordModuleKey } from './feature-flags.types';

export const LANDLORD_MODULE_KEY = 'landlordModuleKey';

export const RequiresLandlordModule = (key: LandlordModuleKey) =>
  SetMetadata(LANDLORD_MODULE_KEY, key);

/**
 * Vérifie qu'un module est activé pour le bailleur courant (JWT BAILLEUR).
 * Attend req.user.landlordProfileId ou le résout via userId.
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
    const user = req.user as {
      userId?: number;
      landlordProfileId?: number;
    };
    if (!user?.userId) return false;

    if (user.landlordProfileId) {
      await this.featureFlags.assertModuleEnabled(
        user.landlordProfileId,
        moduleKey,
      );
      return true;
    }

    await this.featureFlags.assertModuleEnabledForUser(user.userId, moduleKey);
    return true;
  }
}
