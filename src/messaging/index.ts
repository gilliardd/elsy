import type { MessagingClient } from './types';
import { BaileysClient } from './whatsapp/baileysClient';

let instance: MessagingClient | null = null;

export function getMessagingClient(): MessagingClient {
  if (!instance) {
    instance = new BaileysClient();
  }
  return instance;
}

export type { MessagingClient, IncomingMessage, ConnectionStatus, SendOptions } from './types';
