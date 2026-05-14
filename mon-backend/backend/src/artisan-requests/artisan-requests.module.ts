import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthModule } from '../auth/auth.module';
import { ArtisanRequestsService } from './artisan-requests.service';
import { ArtisanRequestsTenantController } from './artisan-requests-tenant.controller';
import { ArtisanRequestsAdminController } from './artisan-requests-admin.controller';
import { ArtisanRequestsLandlordController } from './artisan-requests-landlord.controller';

/**
 * Module Sprint 4 — demandes d'artisan ouvertes par les locataires et
 * traitées par l'owner de la plateforme (toi). Le bailleur n'a qu'une
 * vue lecture seule sur les demandes de ses propres locataires.
 *
 * Volontairement séparé du module artisans/ existant qui sera utilisé
 * plus tard pour la gestion des prestataires des bailleurs eux-mêmes.
 */
@Module({
  imports: [AuthModule],
  controllers: [
    ArtisanRequestsTenantController,
    ArtisanRequestsAdminController,
    ArtisanRequestsLandlordController,
  ],
  providers: [
    PrismaService,
    NotificationsService,
    ArtisanRequestsService,
  ],
  exports: [ArtisanRequestsService],
})
export class ArtisanRequestsModule {}
