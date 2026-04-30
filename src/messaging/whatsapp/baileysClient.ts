import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  type WASocket,
  type WAMessage,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import type {
  MessagingClient,
  ConnectionStatus,
  IncomingMessage,
  SendOptions,
} from '../types';
import { logMessage } from '../../models/MessageLog';

// Logger silenciado para nao poluir stdout com logs internos do Baileys.
const baileysLogger = pino({ level: 'warn' }) as any;

const SESSION_DIR = path.resolve(__dirname, '../../../whatsapp-session');

function jidToPhone(jid: string | undefined | null): string | null {
  if (!jid) return null;
  const m = jid.match(/^(\d+)@/);
  return m ? m[1] : null;
}

function phoneToJid(phone: string): string {
  return `${phone}@s.whatsapp.net`;
}

export class BaileysClient implements MessagingClient {
  private sock: WASocket | null = null;
  private connStatus: ConnectionStatus = 'disconnected';
  private latestQrDataUrl: string | null = null;
  private myPhone: string | null = null;
  private handlers: ((msg: IncomingMessage) => void | Promise<void>)[] = [];
  private startPromise: Promise<void> | null = null;
  private shouldReconnect = true;

  status(): ConnectionStatus {
    return this.connStatus;
  }

  connectedPhone(): string | null {
    return this.myPhone;
  }

  currentQrDataUrl(): string | null {
    return this.latestQrDataUrl;
  }

  onMessage(handler: (msg: IncomingMessage) => void | Promise<void>): void {
    this.handlers.push(handler);
  }

  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    this.startPromise = this._connect();
    return this.startPromise;
  }

  private async _connect(): Promise<void> {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    this.connStatus = 'connecting';

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      logger: baileysLogger,
      printQRInTerminal: false,
      browser: ['Elsy', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', (u) => this._handleConnectionUpdate(u));
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        try {
          await this._handleIncoming(m);
        } catch (err) {
          console.error('Erro processando mensagem WhatsApp:', err);
        }
      }
    });
  }

  private async _handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.connStatus = 'qr_required';
      try {
        this.latestQrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
        console.log('📱 QR Code do WhatsApp atualizado. Escaneie no painel admin.');
      } catch (err) {
        console.error('Erro gerando QR:', err);
      }
    }

    if (connection === 'open') {
      this.connStatus = 'connected';
      this.latestQrDataUrl = null;
      this.myPhone = jidToPhone(this.sock?.user?.id);
      console.log(`✅ WhatsApp conectado como ${this.myPhone || '(desconhecido)'}`);
    }

    if (connection === 'close') {
      this.connStatus = 'disconnected';
      this.startPromise = null;

      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.warn('⚠️  Sessao WhatsApp expirou (loggedOut). Limpe whatsapp-session/ e reescaneie.');
        this.shouldReconnect = false;
      } else if (this.shouldReconnect) {
        console.log('🔁 Reconectando WhatsApp em 3s...');
        setTimeout(() => this.start().catch(console.error), 3_000);
      }
    }
  }

  private async _handleIncoming(m: WAMessage): Promise<void> {
    if (!m.message || m.key.fromMe) return;

    const fromJid = m.key.remoteJid;
    if (!fromJid || fromJid.endsWith('@g.us') || fromJid.endsWith('@broadcast')) {
      // Ignora grupos e broadcast lists
      return;
    }

    const fromPhone = jidToPhone(fromJid);
    if (!fromPhone) return;

    const fromName = m.pushName || undefined;
    const timestamp = m.messageTimestamp
      ? new Date(Number(m.messageTimestamp) * 1000)
      : new Date();

    const incoming: IncomingMessage = {
      id: m.key.id || '',
      fromPhone,
      fromName,
      timestamp,
      raw: m,
    };

    // Texto (incluindo legendas e respostas conversacionais)
    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      undefined;
    if (text) incoming.text = text;

    // Voz/audio
    if (m.message.audioMessage) {
      try {
        const buf = (await downloadMediaMessage(m, 'buffer', {})) as Buffer;
        incoming.voice = {
          buffer: buf,
          mimeType: m.message.audioMessage.mimetype || 'audio/ogg',
          durationSeconds: m.message.audioMessage.seconds || undefined,
        };
      } catch (err) {
        console.error('Erro baixando audio:', err);
      }
    }

    // Imagem
    if (m.message.imageMessage) {
      try {
        const buf = (await downloadMediaMessage(m, 'buffer', {})) as Buffer;
        incoming.image = {
          buffer: buf,
          mimeType: m.message.imageMessage.mimetype || 'image/jpeg',
          caption: m.message.imageMessage.caption || undefined,
        };
      } catch (err) {
        console.error('Erro baixando imagem:', err);
      }
    }

    // Loga entrada
    await logMessage({
      channel: 'whatsapp',
      direction: 'in',
      phone: fromPhone,
      content: text || (incoming.voice ? '[audio]' : incoming.image ? '[imagem]' : '[outro]'),
      status: 'received',
      metadata: { messageId: incoming.id, fromName },
    });

    // Dispatch para handlers registrados
    for (const h of this.handlers) {
      try {
        await h(incoming);
      } catch (err) {
        console.error('Erro em handler de mensagem:', err);
      }
    }
  }

  async sendText(toPhone: string, text: string, options?: SendOptions): Promise<void> {
    if (!this.sock || this.connStatus !== 'connected') {
      await logMessage({
        channel: 'whatsapp',
        direction: 'out',
        phone: toPhone,
        content: text,
        status: 'skipped_offline',
      });
      console.warn(`⚠️  WhatsApp offline; mensagem para ${toPhone} nao foi enviada.`);
      return;
    }

    let body = text;
    if (options?.replyOptions && options.replyOptions.length > 0) {
      const lines = options.replyOptions.map((o, i) => `*${o.value}* — ${o.label}`).join('\n');
      body = `${text}\n\n${lines}`;
    }

    const jid = phoneToJid(toPhone);
    try {
      await this.sock.sendMessage(jid, { text: body });
      await logMessage({
        channel: 'whatsapp',
        direction: 'out',
        phone: toPhone,
        content: body,
        status: 'sent',
      });
    } catch (err: any) {
      await logMessage({
        channel: 'whatsapp',
        direction: 'out',
        phone: toPhone,
        content: body,
        status: 'error',
        error: err?.message || String(err),
      });
      throw err;
    }
  }

  async resolvePhone(toPhone: string): Promise<string | null> {
    if (!this.sock || this.connStatus !== 'connected') return null;
    try {
      const result = await this.sock.onWhatsApp(phoneToJid(toPhone));
      if (result && result.length > 0 && result[0].exists) {
        return result[0].jid;
      }
      return null;
    } catch {
      return null;
    }
  }

  async stop(): Promise<void> {
    this.shouldReconnect = false;
    try {
      await this.sock?.logout();
    } catch {
      // ignora
    }
    this.sock = null;
    this.connStatus = 'disconnected';
  }
}
