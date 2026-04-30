import { query } from '../config/database';

export interface Category {
  id: number;
  user_id: number | null;
  name: string;
  type: 'income' | 'expense' | 'investment';
  icon: string;
  color: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function getAllCategories(userId: number): Promise<Category[]> {
  return query<Category[]>(
    'SELECT * FROM categories WHERE user_id = ? AND is_active = true ORDER BY name',
    [userId]
  );
}

export async function getCategoriesByType(
  userId: number,
  type: 'income' | 'expense' | 'investment'
): Promise<Category[]> {
  return query<Category[]>(
    'SELECT * FROM categories WHERE user_id = ? AND type = ? AND is_active = true ORDER BY name',
    [userId, type]
  );
}

export async function getCategoryById(userId: number, id: number): Promise<Category | null> {
  const rows = await query<Category[]>(
    'SELECT * FROM categories WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return rows[0] || null;
}

export async function getCategoryByName(
  userId: number,
  name: string,
  type: 'income' | 'expense'
): Promise<Category | null> {
  const rows = await query<Category[]>(
    `SELECT * FROM categories
     WHERE user_id = ? AND LOWER(name) = LOWER(?) AND type = ? AND is_active = true`,
    [userId, name, type]
  );
  return rows[0] || null;
}

export async function findBestCategoryMatch(
  userId: number,
  name: string,
  type: 'income' | 'expense'
): Promise<Category | null> {
  // Match exato
  let category = await getCategoryByName(userId, name, type);
  if (category) return category;

  const categories = await getCategoriesByType(userId, type);

  // Match parcial
  const lowerName = name.toLowerCase();
  for (const cat of categories) {
    if (cat.name.toLowerCase().includes(lowerName) || lowerName.includes(cat.name.toLowerCase())) {
      return cat;
    }
  }

  // Fallback "Outros"
  return categories.find((c) => c.name.toLowerCase() === 'outros') || categories[0] || null;
}

export interface CreateCategoryDTO {
  name: string;
  type: 'income' | 'expense' | 'investment';
  icon?: string;
  color?: string;
}

export async function createCategory(userId: number, data: CreateCategoryDTO): Promise<number> {
  const result = await query<any>(
    `INSERT INTO categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)`,
    [userId, data.name, data.type, data.icon || 'circle', data.color || '#6B7280']
  );
  return result.insertId;
}

export async function updateCategory(
  userId: number,
  id: number,
  data: Partial<CreateCategoryDTO>
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.icon) {
    fields.push('icon = ?');
    values.push(data.icon);
  }
  if (data.color) {
    fields.push('color = ?');
    values.push(data.color);
  }

  if (fields.length > 0) {
    values.push(id, userId);
    await query(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
  }
}

export async function deleteCategory(userId: number, id: number): Promise<void> {
  await query(
    'UPDATE categories SET is_active = false WHERE id = ? AND user_id = ?',
    [id, userId]
  );
}

// Clona categorias template (user_id IS NULL) para um novo user_id.
// Usado no signup e no script de bootstrap do admin.
export async function cloneTemplateCategoriesToUser(userId: number): Promise<void> {
  await query(
    `INSERT INTO categories (user_id, name, type, icon, color, is_active)
     SELECT ?, name, type, icon, color, is_active
     FROM categories
     WHERE user_id IS NULL AND is_active = true`,
    [userId]
  );
}
