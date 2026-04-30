import {
  createOtp,
  consumeOtp,
  getResendCooldownMs,
  type OtpPurpose,
} from '../models/OtpCode';
import { logMessage } from '../models/MessageLog';
import { generateOtpCode } from '../utils/otp';
import { env } from '../config/env';

const PURPOSE_LABEL: Record<OtpPurpose, string> = {
  signup: 'verificar seu numero',
  login: 'fazer login',
  reset_password: 'redefinir sua senha',
  change_phone: 'alterar seu numero',
};

// Stub do envio. Na Fase 3 (Baileys) sera substituido por envio real
// via WhatsApp. Por enquanto, gravamos em message_logs e logamos em
// stdout em ambiente de desenvolvimento.
async function deliverOtp(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
  const message = `Seu codigo Elsy para ${PURPOSE_LABEL[purpose]}: ${code}\nValido por 5 minutos.`;

  await logMessage({
    channel: 'whatsapp',
    direction: 'out',
    phone,
    content: message,
    status: 'stub',
    metadata: { purpose, kind: 'otp' },
  });

  if (env.nodeEnv !== 'production') {
    console.log(`📲 [OTP stub] phone=${phone} purpose=${purpose} code=${code}`);
  }
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
