import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export interface Customer {
  id: number;
  user_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  notes: string | null;
  total_billed_cents: number;
  total_paid_cents: number;
  last_visit_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCustomerDTO {
  name: string;
  phone?: string;
  email?: string;
  cpf_cnpj?: string;
  notes?: string;
}

export async function createCustomer(userId: number, data: CreateCustomerDTO): Promise<number> {
  const result = await query<ResultSetHeader>(
    `INSERT INTO customers (user_id, name, phone, email, cpf_cnpj, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.name.trim(),
      data.phone || null,
      data.email || null,
      data.cpf_cnpj || null,
      data.notes || null,
    ]
  );
  return result.insertId;
}

export async function getCustomerById(userId: number, id: number): Promise<Customer | null> {
  const rows = await query<Customer[]>(
    `SELECT * FROM customers WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return rows[0] || null;
}

export async function getCustomerByName(userId: number, name: string): Promise<Customer | null> {
  // Match exato case-insensitive primeiro; depois LIKE 'NOME%'
  const exact = await query<Customer[]>(
    `SELECT * FROM customers
     WHERE user_id = ? AND is_active = TRUE AND LOWER(name) = LOWER(?)
     LIMIT 1`,
    [userId, name.trim()]
  );
  if (exact[0]) return exact[0];

  const partial = await query<Customer[]>(
    `SELECT * FROM customers
     WHERE user_id = ? AND is_active = TRUE AND LOWER(name) LIKE LOWER(?)
     ORDER BY (LOWER(name) = LOWER(?)) DESC, name
     LIMIT 1`,
    [userId, `${name.trim()}%`, name.trim()]
  );
  return partial[0] || null;
}

export async function getOrCreateAvulsoCustomer(userId: number): Promise<Customer> {
  let c = await getCustomerByName(userId, 'Avulso');
  if (c) return c;
  const id = await createCustomer(userId, {
    name: 'Avulso',
    notes: 'Cliente generico para lancamentos sem cadastro especifico',
  });
  return (await getCustomerById(userId, id))!;
}

export async function listCustomers(
  userId: number,
  opts: { limit?: number; offset?: number; search?: string; activeOnly?: boolean } = {}
): Promise<{ customers: Customer[]; total: number }> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const where: string[] = ['user_id = ?'];
  const params: any[] = [userId];

  if (opts.activeOnly !== false) where.push('is_active = TRUE');
  if (opts.search) {
    where.push('(name LIKE ? OR phone LIKE ?)');
    const t = `%${opts.search}%`;
    params.push(t, t);
  }

  const whereSql = where.join(' AND ');

  const totalRow = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM customers WHERE ${whereSql}`,
    params
  );

  const customers = await query<Customer[]>(
    `SELECT * FROM customers WHERE ${whereSql}
     ORDER BY name LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { customers, total: Number(totalRow[0]?.total || 0) };
}

export async function updateCustomer(
  userId: number,
  id: number,
  data: Partial<CreateCustomerDTO>
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name.trim()); }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone || null); }
  if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email || null); }
  if (data.cpf_cnpj !== undefined) { fields.push('cpf_cnpj = ?'); values.push(data.cpf_cnpj || null); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes || null); }

  if (fields.length === 0) return;

  values.push(id, userId);
  await query(
    `UPDATE customers SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );
}

export async function deleteCustomer(userId: number, id: number): Promise<void> {
  await query(
    `UPDATE customers SET is_active = FALSE WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
}

// Atualiza totalizadores e last_visit_at — chamado quando recebivel e pago
// ou quando recebivel novo e criado (depende do contexto).
export async function bumpBilled(userId: number, customerId: number, amountCents: number): Promise<void> {
  await query(
    `UPDATE customers SET total_billed_cents = total_billed_cents + ?,
                          last_visit_at = NOW()
     WHERE id = ? AND user_id = ?`,
    [amountCents, customerId, userId]
  );
}

export async function bumpPaid(userId: number, customerId: number, amountCents: number): Promise<void> {
  await query(
    `UPDATE customers SET total_paid_cents = total_paid_cents + ?
     WHERE id = ? AND user_id = ?`,
    [amountCents, customerId, userId]
  );
}
