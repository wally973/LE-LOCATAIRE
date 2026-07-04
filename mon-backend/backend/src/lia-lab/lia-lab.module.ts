import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GrockModule } from '../grock/grock.module';
import { LiaLabController } from './lia-lab.controller';
import { LiaLabService } from './lia-lab.service';

@Module({
  imports: [GrockModule, PrismaModule],
  controllers: [LiaLabController],
  providers: [LiaLabService],
})
export class LiaLabModule {}
