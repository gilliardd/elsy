// Validacoes BR: CPF e telefone.

// Normaliza telefone BR para o formato E.164 sem o +: 5511999999999.
// Aceita entradas com mascara, espacos, parenteses e o codigo 55 ou nao.
// Retorna null se o numero nao for valido.
export function normalizePhoneBR(input: string): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');

  // Casos validos:
  //  - 11 digitos: DDD (2) + 9 + 8 digitos (celular BR moderno)
  //  - 10 digitos: DDD (2) + 8 digitos (fixo BR)
  //  - 12 digitos: 55 + DDD + 8 (fixo com codigo)
  //  - 13 digitos: 55 + DDD + 9 + 8 (celular com codigo)

  let national: string;
  if (digits.length === 13 && digits.startsWith('55')) national = digits.slice(2);
  else if (digits.length === 12 && digits.startsWith('55')) national = digits.slice(2);
  else if (digits.length === 11 || digits.length === 10) national = digits;
  else return null;

  if (national.length === 11) {
    // celular: 9 inicial obrigatorio
    if (national[2] !== '9') return null;
  } else if (national.length === 10) {
    // fixo: 9 nao deve estar la
    if (national[2] === '9') return null;
  } else {
    return null;
  }

  // DDD valido (11..99)
  const ddd = parseInt(national.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return null;

  return '55' + national;
}

// Valida CPF (algoritmo dos digitos verificadores).
// Aceita string com ou sem mascara. Retorna o CPF apenas com digitos
// se valido, ou null se invalido.
export function normalizeCpf(input: string): string | null {
  if (!input) return null;
  const cpf = input.replace(/\D/g, '');

  if (cpf.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(cpf)) return null; // todos digitos iguais

  const calcDigit = (slice: string, factor: number): number => {
    let sum = 0;
    for (const ch of slice) {
      sum += parseInt(ch, 10) * factor--;
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  if (d1 !== parseInt(cpf[9], 10)) return null;

  const d2 = calcDigit(cpf.slice(0, 10), 11);
  if (d2 !== parseInt(cpf[10], 10)) return null;

  return cpf;
}

// Valida email (regex pragmatico — nao tenta cobrir 100% da RFC 5322).
export function isValidEmail(input: string): boolean {
  if (!input) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

// Valida senha forte: 8+ chars, ao menos 1 letra e 1 numero.
export function isStrongPassword(input: string): boolean {
  if (!input || input.length < 8) return false;
  if (!/[A-Za-z]/.test(input)) return false;
  if (!/\d/.test(input)) return false;
  return true;
}
