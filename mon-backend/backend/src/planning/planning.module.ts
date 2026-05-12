import { Module } from '@nestjs/common';
import { PlanningService } from './planning.service';
import { PlanningController } from './planning.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiQualityService } from '../ai/ai-quality.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PlanningController],
  providers: [
    PrismaService,
    NotificationsService,
    AiQualityService,
    PlanningService,
  ],
  exports: [PlanningService],
})
export class PlanningModule {}
