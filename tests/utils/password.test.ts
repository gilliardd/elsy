import { describe, it, expect } from 'vitest';
import {
  hashPasswordBcrypt,
  hashPasswordSha256,
  verifyPassword,
} from '../../src/utils/password';

describe('password utils', () => {
  it('verifica bcrypt corretamente', () => {
    const hash = hashPasswordBcrypt('minha-senha');
    const r = verifyPassword('minha-senha', hash, 'bcrypt');
    expect(r.valid).toBe(true);
    expect(r.needsRehash).toBe(false);
  });

  it('verifica SHA-256 e marca para rehash', () => {
    const hash = hashPasswordSha256('legada');
    const r = verifyPassword('legada', hash, 'sha256');
    expect(r.valid).toBe(true);
    expect(r.needsRehash).toBe(true);
  });

  it('rejeita senha errada (bcrypt)', () => {
    const hash = hashPasswordBcrypt('certa');
    expect(verifyPassword('errada', hash, 'bcrypt').valid).toBe(false);
  });

  it('rejeita senha errada (sha256)', () => {
    const hash = hashPasswordSha256('certa');
    expect(verifyPassword('errada', hash, 'sha256').valid).toBe(false);
  });
});
