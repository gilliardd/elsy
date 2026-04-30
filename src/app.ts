import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

import { env, validateEnv } from './config/env';
import { getPool } from './config/database';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { startWhatsApp, stopWhatsApp } from './whatsapp';
import { ensureAdminExists } from './models/User';

async function main(): Promise<void> {
  console.log('\n🚀 Iniciando Elsy...\n');

  validateEnv();

  try {
    await getPool();
    await ensureAdminExists();
  } catch (error) {
    console.error('❌ Falha ao conectar ao banco de dados. Verifique as configuracoes.');
    process.exit(1);
  }

  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', routes);

  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
      if (err) {
        res.status(200).json({
          message: 'Elsy API esta rodando',
          docs: '/api/health',
        });
      }
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = app.listen(env.port, () => {
    console.log(`\n🌐 Servidor rodando em http://localhost:${env.port}`);
    console.log(`📡 API disponivel em http://localhost:${env.port}/api`);
  });

  // Inicia bot WhatsApp via Baileys (a conexao acontece em background;
  // se ainda nao houver QR escaneado, o admin escaneia pelo painel).
  await startWhatsApp();
  console.log('💬 WhatsApp iniciado. Estado disponivel em /api/admin/whatsapp/status\n');

  const shutdown = async () => {
    console.log('\n⏹️  Encerrando...');
    await stopWhatsApp().catch(() => {});
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
