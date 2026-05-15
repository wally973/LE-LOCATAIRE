import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SocialCasesService } from './social-cases.service';
import { SocialWorkerGuard } from './social-worker.guard';
import { AdminSocialCasesController } from './admin-social-cases.controller';
import { LandlordSocialCasesController } from './landlord-social-cases.controller';
import { LandlordSocialWorkersController } from './landlord-social-workers.controller';
import { SocialWorkerCasesController } from './social-worker-cases.controller';
import { TenantSocialCaseController } from './tenant-social-case.controller';

/**
 * Sprint 5 — Volet social : dossiers SocialCase, référents SocialWorker,
 * journal SocialCaseEvent, endpoints admin / bailleur / référent / locataire.
 */
@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [
    AdminSocialCasesController,
    LandlordSocialCasesController,
    LandlordSocialWorkersController,
    SocialWorkerCasesController,
    TenantSocialCaseController,
  ],
  providers: [SocialCasesService, SocialWorkerGuard],
  exports: [SocialCasesService],
})
export class SocialModule {}
