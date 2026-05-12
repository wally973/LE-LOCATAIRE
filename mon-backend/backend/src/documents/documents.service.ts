import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiLegalService } from '../ai/ai-legal.service';
import { AiInsuranceService } from '../ai/ai-insurance.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { GenerateContractDto } from './dto/generate-contract.dto';
import { GenerateRentReceiptDto } from './dto/generate-rent-receipt.dto';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiLegal: AiLegalService,
    private readonly aiInsurance: AiInsuranceService,
  ) {}

  private getDocumentsDir() {
    return path.join(process.cwd(), 'documents');
  }

  private async generatePdfFile(
    fileName: string,
    build: (doc: typeof PDFDocument) => void,
  ) {
    const dir = this.getDocumentsDir();
    const filePath = path.join(dir, fileName);
    const pdf = new PDFDocument();
    pdf.pipe(createWriteStream(filePath));
    build(pdf);
    pdf.end();
    return filePath;
  }

  async uploadDocument(dto: UploadDocumentDto) {
    return this.prisma.document.create({
      data: {
        type: dto.type as any,
        url: dto.filename,
        housingId: dto.housingId,
        tenantId: dto.tenantId ?? null,
        content: dto.notes ?? null,
      },
    });
  }

  async generateContract(dto: GenerateContractDto) {
    const housing = await this.prisma.housing.findUnique({
      where: { id: dto.housingId },
      include: { landlord: { include: { user: true } } },
    });

    const tenant = await this.prisma.tenantProfile.findUnique({
      where: { id: dto.tenantId },
      include: { user: true },
    });

    if (!housing || !tenant) {
      throw new NotFoundException('Logement ou locataire introuvable');
    }

    const fileName = `contrat-location-${housing.id}-${tenant.id}.pdf`;

    const filePath = await this.generatePdfFile(fileName, (pdf) => {
      pdf.fontSize(20).text('Contrat de location', { underline: true });
      pdf.moveDown();
      pdf.fontSize(12).text(`Bailleur : ${housing.landlord.name}`);
      pdf.text(`Locataire : ${tenant.firstName} ${tenant.lastName}`);
      pdf.text(`Logement : ${housing.address} (${housing.city})`);
      pdf.moveDown();
      pdf.text('Conditions générales :');
      pdf.text('- Le locataire s’engage à respecter les lieux.');
      pdf.text('- Le bailleur s’engage à assurer la jouissance paisible du logement.');
      if (dto.notes) {
        pdf.moveDown();
        pdf.text('Clauses supplémentaires :');
        pdf.text(dto.notes);
      }
    });

    const doc = await this.prisma.document.create({
      data: {
        type: 'CONTRAT_LOCATION',
        url: fileName,
        housingId: housing.id,
        tenantId: tenant.id,
      },
    });

    return { filePath, document: doc };
  }

  async generateRentReceipt(dto: GenerateRentReceiptDto) {
    const tenant = await this.prisma.tenantProfile.findUnique({
      where: { id: dto.tenantId },
      include: { user: true, housing: true },
    });

    if (!tenant || !tenant.housing) {
      throw new NotFoundException('Locataire ou logement introuvable');
    }

    const fileName = `quittance-${tenant.id}-${dto.month}.pdf`;

    const filePath = await this.generatePdfFile(fileName, (pdf) => {
      pdf.fontSize(18).text('Quittance de loyer', { underline: true });
      pdf.moveDown();
      pdf.fontSize(12).text(`Locataire : ${tenant.firstName} ${tenant.lastName}`);
      pdf.text(`Logement : ${tenant.housing!.address} (${tenant.housing!.city})`);
      pdf.text(`Mois : ${dto.month}`);
      pdf.text(`Montant : ${dto.amount.toFixed(2)} €`);
      pdf.moveDown();
      pdf.text('Le bailleur reconnaît avoir reçu la somme ci-dessus au titre du loyer.');
    });

    const doc = await this.prisma.document.create({
      data: {
        type: 'QUITTANCE_LOYER',
        url: fileName,
        housingId: tenant.housing.id,
        tenantId: tenant.id,
      },
    });

    return { filePath, document: doc };
  }

  async checkHousingCompliance(housingId: number) {
    return this.aiLegal.checkHousingCompliance(housingId);
  }

  async checkTenantInsurance(tenantId: number) {
    return this.aiInsurance.checkTenantInsurance(tenantId);
  }

  async getHousingDocuments(housingId: number) {
    return this.prisma.document.findMany({
      where: { housingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTenantDocuments(tenantId: number) {
    return this.prisma.document.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

