import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

async function ensureMigrationsTable(conn: mysql.Connection): Promise<void> {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function appliedMigrations(conn: mysql.Connection): Promise<Set<string>> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    'SELECT filename FROM schema_migrations'
  );
  return new Set(rows.map((r) => r.filename));
}

async function applyFile(conn: mysql.Connection, filePath: string, label: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf-8');
  await conn.query(sql);
  console.log(`✅ ${label}`);
}

async function runMigrations(): Promise<void> {
  console.log('\n🚀 Iniciando migracoes do banco de dados...\n');

  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  console.log('✅ Conectado ao MySQL\n');

  // 1) Schema base (idempotente — usa CREATE TABLE IF NOT EXISTS)
  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    try {
      await applyFile(connection, schemaPath, 'Schema base aplicado');
    } catch (error: any) {
      // Schema base e idempotente; erros de "ja existe" sao esperados em re-runs
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('❌ Erro no schema base:', error.message);
        throw error;
      }
    }
  }

  // 2) Migrations incrementais
  await ensureMigrationsTable(connection);
  const applied = await appliedMigrations(connection);

  const migrationsDir = path.resolve(__dirname, '../../database/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('\n✅ Sem migracoes incrementais.');
    await connection.end();
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`⏭️  ${file} (ja aplicada)`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    try {
      await applyFile(connection, filePath, `Migration ${file} aplicada`);
      await connection.query(
        'INSERT INTO schema_migrations (filename) VALUES (?)',
        [file]
      );
    } catch (error: any) {
      console.error(`❌ Erro na migration ${file}:`, error.message);
      throw error;
    }
  }

  console.log('\n✅ Migracoes concluidas!\n');

  await connection.end();
}

runMigrations().catch((error) => {
  console.error('Erro fatal nas migracoes:', error);
  process.exit(1);
});
