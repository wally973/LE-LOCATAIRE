import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EMAIL_PORT } from './ports/email.port';
import { PUSH_PORT } from './ports/push.port';
import { ConsoleEmailAdapter } from './adapters/console-email.adapter';
import { SmtpEmailAdapter } from './adapters/smtp-email.adapter';
import { RoutingEmailAdapter } from './adapters/routing-email.adapter';
import { ConsolePushAdapter } from './adapters/console-push.adapter';
import { FirebasePushAdapter } from './adapters/firebase-push.adapter';
import { RoutingPushAdapter } from './adapters/routing-push.adapter';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ConsoleEmailAdapter,
    SmtpEmailAdapter,
    RoutingEmailAdapter,
    ConsolePushAdapter,
    FirebasePushAdapter,
    RoutingPushAdapter,
    { provide: EMAIL_PORT, useExisting: RoutingEmailAdapter },
    { provide: PUSH_PORT, useExisting: RoutingPushAdapter },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
