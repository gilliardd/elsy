import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';
import { hashOtpCode, verifyOtpCode, OTP_TTL_MS, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS } from '../utils/otp';

export type OtpPurpose = 'signup' | 'login' | 'reset_password' | 'change_phone';

export interface OtpCode {
  id: number;
  phone: string;
  code_hash: string;
  purpose: OtpPurpose;
  attempts: number;
  expires_at: Date;
  used_at: Date | null;
  metadata: any;
  created_at: Date;
}

// Salva OTP novo. Invalida codigos anteriores ainda validos para o mesmo
// (phone, purpose) marcando-os como usados (used_at = NOW()).
export async function createOtp(
  phone: string,
  code: string,
  purpose: OtpPurpose,
  metadata: any = null
): Promise<number> {
  await query(
    `UPDATE otp_codes SET used_at = NOW()
     WHERE phone = ? AND purpose = ? AND used_at IS NULL`,
    [phone, purpose]
  );

  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const result = await query<ResultSetHeader>(
    `INSERT INTO otp_codes (phone, code_hash, purpose, expires_at, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [phone, hashOtpCode(code), purpose, expiresAt, metadata ? JSON.stringify(metadata) : null]
  );
  return result.insertId;
}

// Valida o codigo. Retorna o registro se OK; null se invalido/expirado/excedido.
// Em caso de codigo invalido (mas registro ativo), incrementa attempts.
export async function consumeOtp(
  phone: string,
  code: string,
  purpose: OtpPurpose
): Promise<OtpCode | null> {
  const rows = await query<OtpCode[]>(
    `SELECT * FROM otp_codes
     WHERE phone = ? AND purpose = ? AND used_at IS NULL
     ORDER BY id DESC LIMIT 1`,
    [phone, purpose]
  );
  const otp = rows[0];
  if (!otp) return null;

  if (new Date(otp.expires_at).getTime() < Date.now()) return null;
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return null;

  if (!verifyOtpCode(code, otp.code_hash)) {
    await query(
      `UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?`,
      [otp.id]
    );
    return null;
  }

  await query(`UPDATE otp_codes SET used_at = NOW() WHERE id = ?`, [otp.id]);
  return otp;
}

// Verifica cooldown do reenvio. Retorna ms restantes ate poder reenviar (0 se OK).
export async function getResendCooldownMs(
  phone: string,
  purpose: OtpPurpose
): Promise<number> {
  const rows = await query<{ created_at: Date }[]>(
    `SELECT created_at FROM otp_codes
     WHERE phone = ? AND purpose = ?
     ORDER BY id DESC LIMIT 1`,
    [phone, purpose]
  );
  if (rows.length === 0) return 0;

  const elapsed = Date.now() - new Date(rows[0].created_at).getTime();
  const remaining = OTP_RESEND_COOLDOWN_MS - elapsed;
  return remaining > 0 ? remaining : 0;
}
