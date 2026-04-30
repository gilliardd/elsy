import { describe, it, expect } from 'vitest';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '../../src/utils/otp';

describe('otp utils', () => {
  it('generateOtpCode produz 6 digitos', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('hashOtpCode + verifyOtpCode roundtrip', () => {
    const code = '123456';
    const hash = hashOtpCode(code);
    expect(hash).not.toBe(code);
    expect(verifyOtpCode(code, hash)).toBe(true);
    expect(verifyOtpCode('999999', hash)).toBe(false);
  });
});
