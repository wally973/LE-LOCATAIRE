import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
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
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [
    ArtisanRequestsTenantController,
    ArtisanRequestsAdminController,
    ArtisanRequestsLandlordController,
  ],
  providers: [ArtisanRequestsService],
  exports: [ArtisanRequestsService],
})
export class ArtisanRequestsModule {}
