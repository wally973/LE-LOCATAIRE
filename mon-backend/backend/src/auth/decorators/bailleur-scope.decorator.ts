import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { BailleurScope as BailleurScopeType } from '../scope/bailleur-scope.types';

/**
 * Récupère la portée multi-tenant calculée par `BailleurScopeGuard`.
 *
 * Usage :
 * ```
 * @UseGuards(JwtAuthGuard, BailleurScopeGuard)
 * @Get()
 * list(@BailleurScope() scope: BailleurScopeType) {
 *   return this.service.findAll(scope);
 * }
 * ```
 */
export const BailleurScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BailleurScopeType => {
    const request = ctx.switchToHttp().getRequest();
    return request.bailleurScope;
  },
);
