import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { GenerateContractDto } from './dto/generate-contract.dto';
import { GenerateRentReceiptDto } from './dto/generate-rent-receipt.dto';

@ApiTags('documents')
@ApiBearerAuth('bearer')
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @Roles('BAILLEUR', 'ADMIN')
  upload(@Body() dto: UploadDocumentDto) {
    return this.documentsService.uploadDocument(dto);
  }

  @Post('generate/contract')
  @Roles('BAILLEUR', 'ADMIN')
  generateContract(@Body() dto: GenerateContractDto) {
    return this.documentsService.generateContract(dto);
  }

  @Post('generate/rent-receipt')
  @Roles('BAILLEUR', 'ADMIN')
  generateRentReceipt(@Body() dto: GenerateRentReceiptDto) {
    return this.documentsService.generateRentReceipt(dto);
  }

  @Get('housing/:id')
  @Roles('BAILLEUR', 'ADMIN')
  getHousingDocuments(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.getHousingDocuments(id);
  }

  @Get('tenant/:id')
  @Roles('BAILLEUR', 'ADMIN')
  getTenantDocuments(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.getTenantDocuments(id);
  }

  @Get('housing/:id/compliance')
  @Roles('BAILLEUR', 'ADMIN')
  checkHousingCompliance(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.checkHousingCompliance(id);
  }

  @Get('tenant/:id/insurance')
  @Roles('BAILLEUR', 'ADMIN')
  checkTenantInsurance(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.checkTenantInsurance(id);
  }
}
