import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EmailMessage, EmailPort } from '../ports/email.port';

/**
 * Envoi email via SMTP (Mailjet, SendGrid SMTP, Brevo, etc.).
 * Variables : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE.
 */
@Injectable()
export class SmtpEmailAdapter implements EmailPort {
  private readonly logger = new Logger(SmtpEmailAdapter.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    const host = process.env.SMTP_HOST;
    if (!host) return null;

    if (!this.transporter) {
      const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
      const secure =
        process.env.SMTP_SECURE === 'true' || port === 465;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
      });
    }
    return this.transporter;
  }

  async send(message: EmailMessage) {
    const transport = this.getTransporter();
    if (!transport) {
      this.logger.warn('SMTP non configuré — email ignoré');
      return { success: false };
    }

    const from =
      process.env.SMTP_FROM ??
      process.env.MAIL_FROM ??
      'noreply@le-locataire.local';

    const info = await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html ?? `<p>${message.text}</p>`,
    });

    return { success: true, providerId: info.messageId };
  }
}
