import { Module } from '@nestjs/common';
import { HousingService } from './housing.service';
import { HousingController } from './housing.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HousingController],
  providers: [HousingService, PrismaService],
})
export class HousingModule {}
