import {
  Controller,
  Patch,
  Get,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PlanningService } from './planning.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { SignInterventionDto } from './dto/sign-intervention.dto';

@ApiTags('planning')
@ApiBearerAuth('bearer')
@Controller('planning')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Patch('slot/:id/sign')
  @Roles('PRESTATAIRE')
  signIntervention(
    @CurrentUser() user,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SignInterventionDto,
  ) {
    return this.planningService.signIntervention(user.userId, id, dto.signatureUrl);
  }

  @Get('slot/:id/report')
  @Roles('BAILLEUR', 'ADMIN')
  getReport(@Param('id', ParseIntPipe) id: number) {
    return this.planningService.getInterventionReport(id);
  }
}
