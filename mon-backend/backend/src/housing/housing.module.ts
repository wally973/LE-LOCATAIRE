import { Module } from '@nestjs/common';
import { HousingService } from './housing.service';
import { HousingController } from './housing.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { TenantOccupancyModule } from '../tenant-occupancy/tenant-occupancy.module';

@Module({
  imports: [AuthModule, TenantOccupancyModule],
  controllers: [HousingController],
  providers: [HousingService, PrismaService],
})
export class HousingModule {}
