import { Injectable } from '@nestjs/common';
import { PushMessage, PushPort } from '../ports/push.port';
import { ConsolePushAdapter } from './console-push.adapter';
import { FirebasePushAdapter } from './firebase-push.adapter';

function isFirebaseConfigured(): boolean {
  return !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    (process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY)
  );
}

/** FCM si credentials présents, sinon log console (dev). */
@Injectable()
export class RoutingPushAdapter implements PushPort {
  constructor(
    private readonly firebase: FirebasePushAdapter,
    private readonly console: ConsolePushAdapter,
  ) {}

  async send(message: PushMessage) {
    if (
      process.env.NOTIFICATIONS_PUSH_ENABLED !== 'false' &&
      isFirebaseConfigured()
    ) {
      return this.firebase.send(message);
    }
    return this.console.send(message);
  }
}
