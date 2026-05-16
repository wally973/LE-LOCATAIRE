import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantOccupancyService } from './tenant-occupancy.service';

@Module({
  imports: [PrismaModule],
  providers: [TenantOccupancyService],
  exports: [TenantOccupancyService],
})
export class TenantOccupancyModule {}
