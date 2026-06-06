import { Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DoctrineLedgerService } from './doctrine-ledger.service';

/** Registre de Sagesse — gouvernance doctrine Architecte (Phase C). */
@ApiTags('doctrine-ledger')
@ApiBearerAuth()
@Controller('doctrine-ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DoctrineLedgerController {
  constructor(private readonly ledger: DoctrineLedgerService) {}

  @Get()
  list(
    @Query('status') status?: 'PENDING_ADMIN_SIGNATURE' | 'SIGNED',
  ) {
    return {
      ledger: this.ledger.getLedger(),
      lessons: this.ledger.listAll(status),
    };
  }

  @Get('pending')
  listPending() {
    return { lessons: this.ledger.listPending() };
  }

  @Post(':id/sign')
  sign(@Param('id') id: string, @Req() req: { user?: { email?: string } }) {
    const signedBy = req.user?.email?.trim() || 'architecte';
    return { lesson: this.ledger.signLesson(id, signedBy) };
  }

  @Delete(':id')
  reject(@Param('id') id: string) {
    return this.ledger.rejectLesson(id);
  }
}
