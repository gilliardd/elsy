import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// 6 digitos numericos. crypto.randomInt e uniforme e seguro.
export function generateOtpCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

export function hashOtpCode(code: string): string {
  return bcrypt.hashSync(code, 8);
}

export function verifyOtpCode(code: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(code, hash);
  } catch {
    return false;
  }
}

// Validade padrao do OTP (5 minutos)
export const OTP_TTL_MS = 5 * 60 * 1000;

// Maximo de tentativas por codigo
export const OTP_MAX_ATTEMPTS = 3;

// Intervalo minimo entre re-envios (60 segundos)
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
