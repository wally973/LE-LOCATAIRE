import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { VIDEO_SEARCH } from './video-search.port';
import { VideoSearchStubAdapter } from './video-search-stub.adapter';
import { VideoLibraryService } from './video-library.service';
import { VideoLibraryTenantController } from './video-library-tenant.controller';
import { VideoLibraryAdminController } from './video-library-admin.controller';

/**
 * Module Sprint 4 — vidéothèque IA.
 *
 * Le port VideoSearchPort est injecté via le token VIDEO_SEARCH et résolu
 * vers VideoSearchStubAdapter en Sprint 4. Sprint 8 = swap vers un adapter
 * YouTube Data API v3 sans toucher au reste du code.
 */
@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule, FeatureFlagsModule],
  controllers: [VideoLibraryTenantController, VideoLibraryAdminController],
  providers: [
    VideoLibraryService,
    VideoSearchStubAdapter,
    {
      provide: VIDEO_SEARCH,
      useExisting: VideoSearchStubAdapter,
    },
  ],
  exports: [VideoLibraryService, VIDEO_SEARCH],
})
export class VideoLibraryModule {}
