import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/utils/encryption';

describe('encryption AES-256-GCM', () => {
  it('criptografa e descriptografa corretamente', () => {
    const plaintext = 'segredo do asaas';
    const enc = encrypt(plaintext);
    expect(enc).not.toBe(plaintext);
    expect(decrypt(enc)).toBe(plaintext);
  });

  it('cada execucao gera ciphertext diferente (IV aleatorio)', () => {
    const a = encrypt('mesma coisa');
    const b = encrypt('mesma coisa');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('mesma coisa');
    expect(decrypt(b)).toBe('mesma coisa');
  });

  it('falha em payload adulterado (tag GCM)', () => {
    const enc = encrypt('algo');
    const buf = Buffer.from(enc, 'base64');
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });
});
