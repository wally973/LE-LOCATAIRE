import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailPort } from '../ports/email.port';

/**
 * Adapter dev — log en console si SMTP non configuré.
 */
@Injectable()
export class ConsoleEmailAdapter implements EmailPort {
  private readonly logger = new Logger(ConsoleEmailAdapter.name);

  async send(message: EmailMessage) {
    this.logger.log(
      `[EMAIL] to=${message.to} subject="${message.subject}" body=${message.text.slice(0, 120)}`,
    );
    return { success: true, providerId: 'console' };
  }
}
