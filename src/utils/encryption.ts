import crypto from 'crypto';
import { env } from '../config/env';

// AES-256-GCM com chave de 32 bytes (64 chars hex no .env).
// Formato encriptado: base64(iv || tag || ciphertext)

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // GCM padrao
const TAG_LEN = 16;

function getKey(): Buffer {
  if (!env.encryptionKey) {
    throw new Error('ENCRYPTION_KEY nao configurada no .env');
  }
  if (env.encryptionKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY deve ter 64 caracteres hex (32 bytes)');
  }
  return Buffer.from(env.encryptionKey, 'hex');
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');

  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
