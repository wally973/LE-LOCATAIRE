import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AiLegalService } from '../ai/ai-legal.service';
import { AiInsuranceService } from '../ai/ai-insurance.service';
import { AuthModule } from '../auth/auth.module';
import { AgentsSharedModule } from '../agents/shared/agents-shared.module';
import { LegalReferencesModule } from '../legal-references/legal-references.module';

@Module({
  imports: [AuthModule, AgentsSharedModule, LegalReferencesModule],
  controllers: [DocumentsController],
  providers: [PrismaService, AiLegalService, AiInsuranceService, DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
