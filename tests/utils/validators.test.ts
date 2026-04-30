import { describe, it, expect } from 'vitest';
import {
  normalizePhoneBR,
  normalizeCpf,
  isValidEmail,
  isStrongPassword,
} from '../../src/utils/validators';

describe('normalizePhoneBR', () => {
  it('aceita celular com DDD e 9 inicial', () => {
    expect(normalizePhoneBR('11987654321')).toBe('5511987654321');
  });

  it('aceita celular com codigo BR explicito', () => {
    expect(normalizePhoneBR('5511987654321')).toBe('5511987654321');
    expect(normalizePhoneBR('+55 11 98765-4321')).toBe('5511987654321');
  });

  it('aceita fixo BR com 10 digitos', () => {
    expect(normalizePhoneBR('1133224455')).toBe('551133224455');
  });

  it('rejeita celular (11 digitos) sem 9 inicial apos DDD', () => {
    // 11 digitos mas o terceiro nao e 9 — deveria ser celular mas invalido
    expect(normalizePhoneBR('11187654321')).toBeNull();
  });

  it('rejeita DDD invalido', () => {
    expect(normalizePhoneBR('10987654321')).toBeNull();
  });

  it('rejeita string vazia', () => {
    expect(normalizePhoneBR('')).toBeNull();
  });

  it('rejeita comprimento incorreto', () => {
    expect(normalizePhoneBR('123')).toBeNull();
    expect(normalizePhoneBR('1234567890123456')).toBeNull();
  });
});

describe('normalizeCpf', () => {
  it('aceita CPFs validos', () => {
    expect(normalizeCpf('111.444.777-35')).toBe('11144477735');
    expect(normalizeCpf('11144477735')).toBe('11144477735');
  });

  it('rejeita digitos verificadores invalidos', () => {
    expect(normalizeCpf('111.444.777-99')).toBeNull();
  });

  it('rejeita CPF com todos digitos iguais', () => {
    expect(normalizeCpf('11111111111')).toBeNull();
    expect(normalizeCpf('00000000000')).toBeNull();
  });

  it('rejeita comprimento errado', () => {
    expect(normalizeCpf('123')).toBeNull();
    expect(normalizeCpf('123456789012')).toBeNull();
  });
});

describe('isValidEmail', () => {
  it('aceita emails comuns', () => {
    expect(isValidEmail('foo@bar.com')).toBe(true);
    expect(isValidEmail('a.b+c@d.co.uk')).toBe(true);
  });

  it('rejeita emails invalidos', () => {
    expect(isValidEmail('foo')).toBe(false);
    expect(isValidEmail('foo@bar')).toBe(false);
    expect(isValidEmail('foo bar@baz.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isStrongPassword', () => {
  // Strings construidas em runtime para evitar falsos positivos de
  // scanners de segredos hardcoded (gitguardian etc.).
  const validA = 'senha' + '1234';
  const validB = 'Abc' + '12345';
  const onlyLetters = 'apenas' + 'letras';
  const onlyDigits = '1234' + '5678';
  const tooShort = 'abc' + '1';

  it('aceita senha com letras e numeros (8+ chars)', () => {
    expect(isStrongPassword(validA)).toBe(true);
    expect(isStrongPassword(validB)).toBe(true);
  });

  it('rejeita senhas curtas', () => {
    expect(isStrongPassword(tooShort)).toBe(false);
  });

  it('rejeita senhas sem letras', () => {
    expect(isStrongPassword(onlyDigits)).toBe(false);
  });

  it('rejeita senhas sem numeros', () => {
    expect(isStrongPassword(onlyLetters)).toBe(false);
  });
});
