import { Module } from '@nestjs/common';
import { LandlordsService } from './landlords.service';
import { LandlordsController } from './landlords.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [LandlordsController],
  providers: [LandlordsService, PrismaService],
})
export class LandlordsModule {}
