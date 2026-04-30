import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../../src/utils/jwt';

describe('jwt utils', () => {
  it('assina e verifica payload', () => {
    const t = signToken({ userId: 7, role: 'user' });
    const decoded = verifyToken(t);
    expect(decoded).toEqual({ userId: 7, role: 'user' });
  });

  it('retorna null para token invalido', () => {
    expect(verifyToken('xxx.yyy.zzz')).toBeNull();
  });

  it('retorna null para token vazio', () => {
    expect(verifyToken('')).toBeNull();
  });
});
