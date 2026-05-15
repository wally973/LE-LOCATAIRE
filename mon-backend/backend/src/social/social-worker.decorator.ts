import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { REQUEST_SOCIAL_WORKER } from './social-worker.guard';

/** Enregistrement SocialWorker + bailleur léger résolu par SocialWorkerGuard. */
export const SocialWorkerCtx = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest()[REQUEST_SOCIAL_WORKER];
});
