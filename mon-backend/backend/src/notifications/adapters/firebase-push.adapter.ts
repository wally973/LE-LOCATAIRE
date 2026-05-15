import { Injectable, Logger } from '@nestjs/common';
import { PushMessage, PushPort, PushSendResult } from '../ports/push.port';

type FirebaseAdmin = typeof import('firebase-admin');

/**
 * Push FCM via Firebase Admin SDK.
 * Config : FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * (clé avec \n échappés dans .env) OU GOOGLE_APPLICATION_CREDENTIALS (chemin JSON).
 */
@Injectable()
export class FirebasePushAdapter implements PushPort {
  private readonly logger = new Logger(FirebasePushAdapter.name);
  private initialized = false;
  private messaging: import('firebase-admin/messaging').Messaging | null =
    null;

  private async ensureInit(): Promise<boolean> {
    if (this.initialized) return this.messaging != null;

    try {
      const admin = (await import('firebase-admin')) as FirebaseAdmin;

      if (!admin.apps.length) {
        const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (credPath) {
          admin.initializeApp({
            credential: admin.credential.cert(credPath),
          });
        } else if (
          process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY
        ) {
          const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(
            /\\n/g,
            '\n',
          );
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey,
            }),
          });
        } else {
          this.logger.warn('Firebase non configuré — push ignoré');
          this.initialized = true;
          return false;
        }
      }

      this.messaging = admin.messaging();
      this.initialized = true;
      return true;
    } catch (e) {
      this.logger.error('Init Firebase échouée', e);
      this.initialized = true;
      return false;
    }
  }

  async send(message: PushMessage): Promise<PushSendResult> {
    if (message.tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const ok = await this.ensureInit();
    if (!ok || !this.messaging) {
      return {
        successCount: 0,
        failureCount: message.tokens.length,
        invalidTokens: [],
      };
    }

    const res = await this.messaging.sendEachForMulticast({
      tokens: message.tokens,
      notification: {
        title: message.title,
        body: message.body,
      },
      data: message.data,
    });

    const invalidTokens: string[] = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(message.tokens[i]!);
        }
      }
    });

    return {
      successCount: res.successCount,
      failureCount: res.failureCount,
      invalidTokens,
    };
  }
}
