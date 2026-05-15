export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<{ success: boolean; providerId?: string }>;
}

export const EMAIL_PORT = Symbol('EMAIL_PORT');
