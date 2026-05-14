import { Module } from '@nestjs/common';
import { ContratsController } from './contrats.controller';
import { ContratsService } from './contrats.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ContratsController],
  providers: [ContratsService, PrismaService],
  exports: [ContratsService],
})
export class ContratsModule {}
