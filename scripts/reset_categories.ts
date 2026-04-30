/**
 * Reset completo das categorias.
 *
 * Apaga todas as categorias (templates e por usuario) e re-cria as 21
 * seeds canonicas do schema.sql como templates (user_id IS NULL),
 * depois clona para o admin.
 *
 * USO PONTUAL: este script existe para limpar o estado herdado da
 * migracao para SaaS, onde categorias customizadas pre-existentes
 * viraram templates indevidamente.
 */
import { query, closePool } from '../src/config/database';
import { cloneTemplateCategoriesToUser } from '../src/models/Category';

const SEEDS = [
  // Despesas
  { name: 'Alimentacao', type: 'expense', icon: 'utensils', color: '#EF4444' },
  { name: 'Transporte', type: 'expense', icon: 'car', color: '#F97316' },
  { name: 'Moradia', type: 'expense', icon: 'home', color: '#8B5CF6' },
  { name: 'Saude', type: 'expense', icon: 'heart', color: '#EC4899' },
  { name: 'Educacao', type: 'expense', icon: 'graduation-cap', color: '#06B6D4' },
  { name: 'Lazer', type: 'expense', icon: 'gamepad', color: '#10B981' },
  { name: 'Vestuario', type: 'expense', icon: 'shirt', color: '#6366F1' },
  { name: 'Contas', type: 'expense', icon: 'file-text', color: '#F59E0B' },
  { name: 'Assinaturas', type: 'expense', icon: 'repeat', color: '#14B8A6' },
  { name: 'Outros', type: 'expense', icon: 'more-horizontal', color: '#6B7280' },

  // Receitas
  { name: 'Salario', type: 'income', icon: 'briefcase', color: '#22C55E' },
  { name: 'Freelance', type: 'income', icon: 'laptop', color: '#3B82F6' },
  { name: 'Investimentos', type: 'income', icon: 'trending-up', color: '#8B5CF6' },
  { name: 'Vendas', type: 'income', icon: 'shopping-bag', color: '#F97316' },
  { name: 'Outros', type: 'income', icon: 'plus-circle', color: '#6B7280' },

  // Investimentos
  { name: 'Acoes', type: 'investment', icon: 'bar-chart-2', color: '#3B82F6' },
  { name: 'Renda Fixa', type: 'investment', icon: 'lock', color: '#22C55E' },
  { name: 'Fundos', type: 'investment', icon: 'pie-chart', color: '#8B5CF6' },
  { name: 'Criptomoedas', type: 'investment', icon: 'bitcoin', color: '#F97316' },
  { name: 'Imoveis', type: 'investment', icon: 'building', color: '#6366F1' },
  { name: 'Poupanca', type: 'investment', icon: 'piggy-bank', color: '#10B981' },
];

async function main() {
  console.log('🔍 Verificando dependencias em transactions/bills/budgets...');

  const txCount = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM transactions`
  );
  const billCount = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM bills`
  );

  if (Number(txCount[0].count) > 0 || Number(billCount[0].count) > 0) {
    console.error(
      `❌ Abortando: existem ${txCount[0].count} transactions e ${billCount[0].count} bills.`
    );
    console.error('Reset de categorias destruiria estes registros via FK.');
    await closePool();
    process.exit(1);
  }

  console.log('✅ Sem dependencias. Prosseguindo.');

  console.log('🗑️  Apagando todas as categorias...');
  await query(`DELETE FROM categories`);
  await query(`ALTER TABLE categories AUTO_INCREMENT = 1`);

  console.log(`📥 Inserindo ${SEEDS.length} categorias canonicas como templates...`);
  for (const c of SEEDS) {
    await query(
      `INSERT INTO categories (user_id, name, type, icon, color, is_active)
       VALUES (NULL, ?, ?, ?, ?, TRUE)`,
      [c.name, c.type, c.icon, c.color]
    );
  }

  console.log('🔁 Clonando templates para o admin (user_id=1)...');

  const admins = await query<{ id: number; username: string }[]>(
    `SELECT id, username FROM users WHERE role = 'admin' AND is_active = TRUE ORDER BY id LIMIT 1`
  );
  if (admins.length === 0) {
    console.error('❌ Nenhum admin encontrado.');
    await closePool();
    process.exit(1);
  }

  await cloneTemplateCategoriesToUser(admins[0].id);

  const after = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM categories WHERE user_id = ?`,
    [admins[0].id]
  );
  const tplCount = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM categories WHERE user_id IS NULL`
  );

  console.log(`✅ Reset concluido:`);
  console.log(`   • ${tplCount[0].count} templates (user_id IS NULL)`);
  console.log(`   • ${after[0].count} categorias clonadas para admin (id=${admins[0].id}, ${admins[0].username})`);

  await closePool();
}

main().catch(async (err) => {
  console.error('❌ Erro no reset:', err);
  await closePool();
  process.exit(1);
});
