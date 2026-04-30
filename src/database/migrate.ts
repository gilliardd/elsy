import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

const SCHEMA_KEY = '__schema__';

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

async function tableExists(conn: mysql.Connection, tableName: string): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function markApplied(conn: mysql.Connection, filename: string): Promise<void> {
  await conn.query(
    'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
    [filename]
  );
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

  // 1) Tabela de controle (cria se nao existir)
  await ensureMigrationsTable(connection);
  const applied = await appliedMigrations(connection);

  // 2) Schema base — aplicado apenas uma vez (registrado como __schema__).
  //    Em bancos legados que ja tinham as tabelas antes do controle,
  //    apenas registramos como aplicado sem re-executar (o schema.sql
  //    cria categorias seed com INSERT IGNORE — re-executar duplica
  //    templates ja que o MySQL trata NULL como distinto em UNIQUE keys
  //    compostas com user_id IS NULL).
  if (!applied.has(SCHEMA_KEY)) {
    const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const hasTables = await tableExists(connection, 'categories');
      if (hasTables) {
        await markApplied(connection, SCHEMA_KEY);
        console.log('ℹ️  Schema base ja presente (banco legado) — registrado como aplicado');
      } else {
        await applyFile(connection, schemaPath, 'Schema base aplicado');
        await markApplied(connection, SCHEMA_KEY);
      }
    }
  } else {
    console.log('⏭️  Schema base (ja registrado)');
  }

  // 3) Migrations incrementais
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
      await markApplied(connection, file);
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
