import { Module } from '@nestjs/common';
import { PaiementsController } from './paiements.controller';
import { PaiementsService } from './paiements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PaiementsController],
  providers: [PaiementsService, PrismaService],
  exports: [PaiementsService],
})
export class PaiementsModule {}
