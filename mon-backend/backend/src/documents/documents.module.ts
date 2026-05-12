import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AiLegalService } from '../ai/ai-legal.service';
import { AiInsuranceService } from '../ai/ai-insurance.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [PrismaService, AiLegalService, AiInsuranceService, DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
