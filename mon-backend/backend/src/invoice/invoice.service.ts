import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidateInvoiceDto } from './dto/validate-invoice.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { GeneratePdfDto } from './dto/generate-pdf.dto';
import { NotificationsService } from '../notifications/notifications.service';
import Stripe from 'stripe';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';

@Injectable()
export class InvoiceService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Récupérer une facture
  async getInvoice(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        slot: {
          include: {
            ticket: {
              include: { tenant: true, housing: true },
            },
            artisan: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Facture introuvable');
    return invoice;
  }

  // Validation bailleur
  async validateInvoice(userId: number, invoiceId: number, dto: ValidateInvoiceDto) {
    const invoice = await this.getInvoice(invoiceId);

    if (invoice.landlordId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas valider cette facture');
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: dto.status },
    });
  }

  // Paiement Stripe
  async payInvoice(userId: number, dto: PayInvoiceDto) {
    const invoice = await this.getInvoice(dto.invoiceId);

    if (invoice.landlordId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas payer cette facture');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(invoice.amount * 100),
      currency: 'eur',
      payment_method: dto.paymentMethodId,
      confirm: true,
    });

    await this.prisma.invoice.update({
      where: { id: dto.invoiceId },
      data: { status: 'PAID' },
    });

    return { success: true, paymentIntent };
  }

  // Génération PDF
  async generatePdf(dto: GeneratePdfDto) {
    const invoice = await this.getInvoice(dto.invoiceId);

    const filePath = `./invoices/invoice-${invoice.id}.pdf`;
    const pdf = new PDFDocument();
    pdf.pipe(createWriteStream(filePath));

    pdf.fontSize(20).text('Facture d’intervention', { underline: true });
    pdf.moveDown();

    pdf.fontSize(14).text(`Facture #${invoice.id}`);
    pdf.text(`Montant : ${invoice.amount} €`);
    pdf.text(`Artisan : ${invoice.slot.artisan.email}`);
    pdf.text(`Logement : ${invoice.slot.ticket!.housing.address}`);
    pdf.text(`Date intervention : ${invoice.slot.startDate.toLocaleString()}`);
    pdf.text(`Statut : ${invoice.status}`);

    pdf.end();

    return { filePath };
  }

  // Dashboard bailleur
  async getLandlordDashboard(userId: number) {
    const invoices = await this.prisma.invoice.findMany({
      where: { landlordId: userId },
    });

    const total = invoices.length;
    const paid = invoices.filter(i => i.status === 'PAID').length;
    const pending = invoices.filter(i => i.status === 'PENDING').length;

    return {
      total,
      paid,
      pending,
      unpaid: total - paid,
    };
  }

  /** Liste des factures bailleur (tableau de bord paiements — lecture seule côté UI) */
  async listInvoicesForLandlord(userId: number) {
    return this.prisma.invoice.findMany({
      where: { landlordId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        slot: {
          include: {
            artisan: { select: { id: true, email: true } },
            ticket: {
              include: {
                housing: {
                  select: { id: true, address: true, city: true, postalCode: true },
                },
              },
            },
          },
        },
      },
    });
  }

  // Dashboard artisan
  async getArtisanDashboard(userId: number) {
    const invoices = await this.prisma.invoice.findMany({
      where: { 
        slot: {
          artisanId: userId
        }
      },
    });

    const total = invoices.length;
    const paid = invoices.filter(i => i.status === 'PAID').length;

    return {
      total,
      paid,
      unpaid: total - paid,
    };
  }
}
