import {
  createOtp,
  consumeOtp,
  getResendCooldownMs,
  type OtpPurpose,
} from '../models/OtpCode';
import { generateOtpCode } from '../utils/otp';
import { env } from '../config/env';
import { getMessagingClient } from '../messaging';

const PURPOSE_LABEL: Record<OtpPurpose, string> = {
  signup: 'verificar seu numero',
  login: 'fazer login',
  reset_password: 'redefinir sua senha',
  change_phone: 'alterar seu numero',
};

// Envio real via WhatsApp (adapter). Em ambiente de desenvolvimento, o
// codigo tambem aparece no console para facilitar testes locais. Se o
// WhatsApp estiver desconectado, sendText loga em message_logs com
// status='skipped_offline' e o codigo fica acessivel apenas via DB
// (permite testar mesmo sem QR escaneado).
async function deliverOtp(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
  const message = `📢 *Elsy*\n\nSeu codigo para ${PURPOSE_LABEL[purpose]}: *${code}*\nValido por 5 minutos.`;

  if (env.nodeEnv !== 'production') {
    console.log(`📲 [OTP] phone=${phone} purpose=${purpose} code=${code}`);
  }

  await getMessagingClient().sendText(phone, message);
}

export interface SendOtpResult {
  ok: boolean;
  cooldownMs?: number;
}

export async function sendOtp(
  phone: string,
  purpose: OtpPurpose,
  metadata: any = null
): Promise<SendOtpResult> {
  const cooldown = await getResendCooldownMs(phone, purpose);
  if (cooldown > 0) {
    return { ok: false, cooldownMs: cooldown };
  }

  const code = generateOtpCode();
  await createOtp(phone, code, purpose, metadata);
  await deliverOtp(phone, code, purpose);

  return { ok: true };
}

export async function verifyOtp(
  phone: string,
  code: string,
  purpose: OtpPurpose
): Promise<boolean> {
  const otp = await consumeOtp(phone, code, purpose);
  return otp !== null;
}
