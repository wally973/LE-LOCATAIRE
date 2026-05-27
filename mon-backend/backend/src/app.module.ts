import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { HousingModule } from './housing/housing.module';
import { LandlordsModule } from './landlords/landlords.module';
import { TenantModule } from './tenant/tenant.module';
import { TicketsModule } from './tickets/tickets.module';
import { PlanningModule } from './planning/planning.module';
import { DocumentsModule } from './documents/documents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SocialModule } from './social/social.module';
// import { SupportModule } from './support/support.module';
import { InvoiceModule } from './invoice/invoice.module';
import { AiModule } from './ai/ai.module';
import { ArtisansModule } from './artisans/artisans.module';
import { UploadModule } from './upload/upload.module';
import { AiDiagnosticsModule } from './ai-diagnostics/ai-diagnostics.module';
import { HlmModule } from './hlm/hlm.module';
import { ContratsModule } from './contrats/contrats.module';
import { PaiementsModule } from './paiements/paiements.module';
import { TenantOnboardingModule } from './tenant-onboarding/tenant-onboarding.module';
import { AiRoutingModule } from './ai-routing/ai-routing.module';
import { VideoLibraryModule } from './video-library/video-library.module';
import { ArtisanRequestsModule } from './artisan-requests/artisan-requests.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { AgentsModule } from './agents/agents.module';
import { LegalReferencesModule } from './legal-references/legal-references.module';
import { LiaLabModule } from './lia-lab/lia-lab.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    AdminModule,
    HousingModule,
    LandlordsModule,
    TenantModule,
    TicketsModule,
    PlanningModule,
    DocumentsModule,
    NotificationsModule,
    DashboardModule,
    SocialModule,
    // SupportModule,
    InvoiceModule,
    AiModule,
    ArtisansModule,
    UploadModule,
    AiDiagnosticsModule,
    HlmModule,
    ContratsModule,
    PaiementsModule,
    TenantOnboardingModule,
    AiRoutingModule,
    VideoLibraryModule,
    ArtisanRequestsModule,
    FeatureFlagsModule,
    AgentsModule,
    LegalReferencesModule,
    LiaLabModule,
  ],
})
export class AppModule {}
