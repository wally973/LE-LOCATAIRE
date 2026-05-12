import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { ValidateInvoiceDto } from './dto/validate-invoice.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { GeneratePdfDto } from './dto/generate-pdf.dto';

/**
 * Routes statiques (list, dashboard) avant @Get(':id') pour éviter les conflits de parsing.
 */
@ApiTags('invoice')
@ApiBearerAuth('bearer')
@Controller('invoice')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('list/landlord')
  @Roles('BAILLEUR')
  listLandlordInvoices(@CurrentUser() user: { userId: number }) {
    return this.invoiceService.listInvoicesForLandlord(user.userId);
  }

  @Get('dashboard/landlord')
  @Roles('BAILLEUR')
  landlordDashboard(@CurrentUser() user: { userId: number }) {
    return this.invoiceService.getLandlordDashboard(user.userId);
  }

  @Get('dashboard/artisan')
  @Roles('PRESTATAIRE')
  artisanDashboard(@CurrentUser() user: { userId: number }) {
    return this.invoiceService.getArtisanDashboard(user.userId);
  }

  @Get(':id')
  @Roles('BAILLEUR', 'PRESTATAIRE', 'ADMIN')
  getInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.invoiceService.getInvoice(id);
  }

  @Patch(':id/validate')
  @Roles('BAILLEUR')
  validateInvoice(
    @CurrentUser() user: { userId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValidateInvoiceDto,
  ) {
    return this.invoiceService.validateInvoice(user.userId, id, dto);
  }

  @Post('pay')
  @Roles('BAILLEUR')
  payInvoice(
    @CurrentUser() user: { userId: number },
    @Body() dto: PayInvoiceDto,
  ) {
    return this.invoiceService.payInvoice(user.userId, dto);
  }

  @Post('pdf')
  @Roles('BAILLEUR', 'ADMIN')
  generatePdf(@Body() dto: GeneratePdfDto) {
    return this.invoiceService.generatePdf(dto);
  }
}
