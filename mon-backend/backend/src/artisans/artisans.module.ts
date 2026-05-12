import { Module } from '@nestjs/common';
import { ArtisansService } from './artisans.service';
import { ArtisansController } from './artisans.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ArtisansController],
  providers: [ArtisansService, PrismaService],
})
export class ArtisansModule {}
