// Roda antes de qualquer import dos modulos do projeto, garantindo
// que env.ts pegue valores deterministicos durante os testes.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-vitest-only';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
