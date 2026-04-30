// Adapter de mensageria. Abstrai o canal (WhatsApp via Baileys hoje;
// futuramente WhatsApp Business API oficial, Telegram, SMS, etc.).
//
// Os handlers do bot recebem instancias desta interface em vez de
// acoplar diretamente em uma biblioteca especifica.

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr_required'
  | 'connected';

export interface IncomingMessage {
  id: string;
  fromPhone: string;        // E.164 sem +: 5511999999999
  fromName?: string;
  text?: string;
  voice?: { buffer: Buffer; mimeType: string; durationSeconds?: number };
  image?: { buffer: Buffer; mimeType: string; caption?: string };
  timestamp: Date;
  raw?: any;                // payload bruto do canal (debug)
}

export interface SendOptions {
  // Forca tipagem de resposta numerica para gates de plano
  // ('Responda 1 ou 2'). Quando definido, o adapter pode opcionalmente
  // exibir como botoes onde suportado.
  replyOptions?: { label: string; value: string }[];
}

export interface MessagingClient {
  start(): Promise<void>;
  stop(): Promise<void>;

  status(): ConnectionStatus;
  // Numero conectado (E.164 sem +). Disponivel apos connected.
  connectedPhone(): string | null;
  // QR code atual em DataURL PNG, se status = qr_required.
  currentQrDataUrl(): string | null;

  sendText(toPhone: string, text: string, options?: SendOptions): Promise<void>;

  // Verifica se um numero existe no WhatsApp antes de enviar.
  // Retorna o JID resolvido ou null.
  resolvePhone(toPhone: string): Promise<string | null>;

  // Listener para mensagens recebidas. Multiplos handlers podem ser
  // registrados; sao chamados em ordem de registro.
  onMessage(handler: (msg: IncomingMessage) => void | Promise<void>): void;
}
