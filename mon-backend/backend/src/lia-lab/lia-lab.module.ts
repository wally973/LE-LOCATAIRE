import { Module } from '@nestjs/common';
import { LiaModule } from '../lia/lia.module';
import { LiaLabController } from './lia-lab.controller';
import { LiaLabService } from './lia-lab.service';

@Module({
  imports: [LiaModule],
  controllers: [LiaLabController],
  providers: [LiaLabService],
})
export class LiaLabModule {}
