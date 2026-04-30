// Servico de email via SMTP. Configuracao carregada de system_config
// (encriptada). Cache curto pra evitar I/O em cada envio.

import nodemailer, { Transporter } from 'nodemailer';
import { getConfig } from '../models/SystemConfig';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

let cached: { transporter: Transporter; from: string; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadSmtpConfig(): Promise<SmtpConfig | null> {
  const [host, portStr, user, password, from] = await Promise.all([
    getConfig('smtp_host'),
    getConfig('smtp_port'),
    getConfig('smtp_user'),
    getConfig('smtp_password'),
    getConfig('smtp_from'),
  ]);

  if (!host || !portStr || !user || !password || !from) return null;

  const port = parseInt(portStr, 10);
  if (!Number.isFinite(port) || port <= 0) return null;

  return { host, port, user, password, from };
}

async function getTransporter(): Promise<{ transporter: Transporter; from: string } | null> {
  if (cached && Date.now() < cached.expiresAt) {
    return { transporter: cached.transporter, from: cached.from };
  }

  const cfg = await loadSmtpConfig();
  if (!cfg) return null;

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.password },
  });

  cached = { transporter, from: cfg.from, expiresAt: Date.now() + CACHE_TTL_MS };
  return { transporter, from: cfg.from };
}

export function invalidateSmtpCache(): void {
  cached = null;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Envia email. Se SMTP nao configurado, retorna false silenciosamente
// (notificacoes nao bloqueiam fluxo principal).
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  try {
    const t = await getTransporter();
    if (!t) {
      console.warn(`[email] SMTP nao configurado; pulando envio para ${input.to}`);
      return false;
    }
    await t.transporter.sendMail({
      from: t.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text || input.html.replace(/<[^>]+>/g, ' '),
    });
    return true;
  } catch (err) {
    console.error('[email] erro enviando:', err);
    return false;
  }
}
