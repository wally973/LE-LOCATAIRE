import { Injectable, Logger } from '@nestjs/common';
import { PushMessage, PushPort, PushSendResult } from '../ports/push.port';

@Injectable()
export class ConsolePushAdapter implements PushPort {
  private readonly logger = new Logger(ConsolePushAdapter.name);

  async send(message: PushMessage): Promise<PushSendResult> {
    this.logger.log(
      `[PUSH] tokens=${message.tokens.length} title="${message.title}" body=${message.body.slice(0, 80)}`,
    );
    return {
      successCount: message.tokens.length,
      failureCount: 0,
      invalidTokens: [],
    };
  }
}
