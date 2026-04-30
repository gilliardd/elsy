import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const BCRYPT_ROUNDS = 10;

export function hashPasswordBcrypt(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function hashPasswordSha256(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function verifyBcryptPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

export function verifySha256Password(password: string, hash: string): boolean {
  return hashPasswordSha256(password) === hash;
}

// Verifica usando o algoritmo informado. Retorna se bate e se precisa
// re-hashing para bcrypt (caso ainda esteja em SHA-256).
export function verifyPassword(
  password: string,
  hash: string,
  algo: 'sha256' | 'bcrypt'
): { valid: boolean; needsRehash: boolean } {
  if (algo === 'bcrypt') {
    return { valid: verifyBcryptPassword(password, hash), needsRehash: false };
  }
  return { valid: verifySha256Password(password, hash), needsRehash: true };
}
