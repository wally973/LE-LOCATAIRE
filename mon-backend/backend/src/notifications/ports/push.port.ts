export interface PushMessage {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

export interface PushPort {
  send(message: PushMessage): Promise<PushSendResult>;
}

export const PUSH_PORT = Symbol('PUSH_PORT');
