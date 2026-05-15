import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeatureFlagsService } from './feature-flags.service';
import { LandlordModuleGuard } from './landlord-module.guard';
import { AdminFeatureFlagsController } from './admin-feature-flags.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminFeatureFlagsController],
  providers: [FeatureFlagsService, LandlordModuleGuard],
  exports: [FeatureFlagsService, LandlordModuleGuard],
})
export class FeatureFlagsModule {}
