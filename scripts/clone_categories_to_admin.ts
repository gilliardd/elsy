/**
 * Bootstrap pos-migration 001: clona as categorias template (user_id IS NULL)
 * para o usuario admin existente, para que ele tenha cobertura completa de
 * categorias apos a virada multi-tenant.
 *
 * Executar uma unica vez apos `npm run db:migrate`.
 */
import { query, closePool } from '../src/config/database';
import { cloneTemplateCategoriesToUser } from '../src/models/Category';

async function main() {
  console.log('🔁 Clonando categorias template para o admin...');

  const admins = await query<{ id: number; username: string }[]>(
    `SELECT id, username FROM users WHERE role = 'admin' AND is_active = TRUE ORDER BY id LIMIT 1`
  );

  if (admins.length === 0) {
    console.error('❌ Nenhum admin encontrado. Crie um admin antes de rodar este script.');
    await closePool();
    process.exit(1);
  }

  const admin = admins[0];

  // Verifica se admin ja possui categorias para evitar duplicatas
  const existing = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM categories WHERE user_id = ?`,
    [admin.id]
  );
  const count = Number(existing[0]?.count || 0);

  if (count > 0) {
    console.log(`ℹ️  Admin (id=${admin.id}, username=${admin.username}) ja tem ${count} categorias. Pulando.`);
    await closePool();
    return;
  }

  await cloneTemplateCategoriesToUser(admin.id);

  const after = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM categories WHERE user_id = ?`,
    [admin.id]
  );
  console.log(`✅ ${after[0].count} categorias clonadas para o admin (id=${admin.id}, username=${admin.username}).`);

  await closePool();
}

main().catch(async (err) => {
  console.error('❌ Erro no bootstrap:', err);
  await closePool();
  process.exit(1);
});
