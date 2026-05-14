import { Module } from '@nestjs/common';
import { LandlordsService } from './landlords.service';
import { LandlordsController } from './landlords.controller';
import { LandlordsPublicController } from './landlords-public.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [LandlordsController, LandlordsPublicController],
  providers: [LandlordsService, PrismaService],
})
export class LandlordsModule {}
