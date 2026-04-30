import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'elsy',
  },

  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Encryption (AES-256-GCM key, 32 bytes em hex = 64 chars)
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // URL publica usada nos links das mensagens transacionais
  appUrl: process.env.APP_URL || 'http://localhost:3000',
};

export function validateEnv(): void {
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'OPENAI_API_KEY',
  ];

  const missing = required.filter((key) => !process.env[key] || process.env[key]?.startsWith('seu_'));

  if (missing.length > 0) {
    console.warn(`\n⚠️  Variaveis de ambiente faltando ou nao configuradas:`);
    missing.forEach((key) => console.warn(`   - ${key}`));
    console.warn(`\n   Configure no arquivo .env antes de usar o bot.\n`);
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret' ||
      process.env.JWT_SECRET.startsWith('seu_')) {
    console.warn('⚠️  JWT_SECRET nao configurado ou usando valor padrao. Defina um valor forte em .env.');
  }

  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 64) {
    console.warn('⚠️  ENCRYPTION_KEY nao configurada (precisa de 64 chars hex = 32 bytes). Gere com:');
    console.warn('     node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
}
