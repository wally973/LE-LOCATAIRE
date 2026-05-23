import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LegalReferencesController } from './legal-references.controller';
import { LegalReferencesService } from './legal-references.service';

@Module({
  imports: [PrismaModule],
  controllers: [LegalReferencesController],
  providers: [LegalReferencesService],
  exports: [LegalReferencesService],
})
export class LegalReferencesModule {}
