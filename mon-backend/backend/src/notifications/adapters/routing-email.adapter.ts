import { Injectable } from '@nestjs/common';
import { EmailMessage, EmailPort } from '../ports/email.port';
import { ConsoleEmailAdapter } from './console-email.adapter';
import { SmtpEmailAdapter } from './smtp-email.adapter';

/** SMTP si configuré, sinon log console (dev). */
@Injectable()
export class RoutingEmailAdapter implements EmailPort {
  constructor(
    private readonly smtp: SmtpEmailAdapter,
    private readonly console: ConsoleEmailAdapter,
  ) {}

  async send(message: EmailMessage) {
    const emailEnabled = process.env.NOTIFICATIONS_EMAIL_ENABLED !== 'false';
    if (emailEnabled && process.env.SMTP_HOST) {
      const result = await this.smtp.send(message);
      if (result.success) return result;
    }
    return this.console.send(message);
  }
}
