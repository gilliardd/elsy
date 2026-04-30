import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export type PlanAccountType = 'personal' | 'business' | 'any';

export interface Plan {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  trial_days: number;
  account_type: PlanAccountType;
  asaas_billing_type: string;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePlanDTO {
  name: string;
  description?: string;
  price_cents: number;
  trial_days: number;
  account_type?: PlanAccountType;
  asaas_billing_type?: string;
  is_active?: boolean;
  sort_order?: number;
}

export async function getAllPlans(includeInactive = false): Promise<Plan[]> {
  return query<Plan[]>(
    includeInactive
      ? 'SELECT * FROM plans ORDER BY sort_order, id'
      : 'SELECT * FROM plans WHERE is_active = TRUE ORDER BY sort_order, id'
  );
}

// Filtra planos visiveis para o tipo de conta indicado.
// account_type 'personal' ve planos personal+any; 'business' ve business+any.
export async function getPlansForAccountType(
  accountType: 'personal' | 'business'
): Promise<Plan[]> {
  return query<Plan[]>(
    `SELECT * FROM plans
     WHERE is_active = TRUE AND (account_type = ? OR account_type = 'any')
     ORDER BY sort_order, id`,
    [accountType]
  );
}

export async function getPlanById(id: number): Promise<Plan | null> {
  const rows = await query<Plan[]>('SELECT * FROM plans WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function createPlan(data: CreatePlanDTO): Promise<number> {
  const result = await query<ResultSetHeader>(
    `INSERT INTO plans (name, description, price_cents, trial_days,
                        account_type, asaas_billing_type, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.description || null,
      data.price_cents,
      data.trial_days,
      data.account_type || 'any',
      data.asaas_billing_type || 'CREDIT_CARD',
      data.is_active ?? true,
      data.sort_order ?? 0,
    ]
  );
  return result.insertId;
}

export async function updatePlan(
  id: number,
  data: Partial<CreatePlanDTO>
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.price_cents !== undefined) { fields.push('price_cents = ?'); values.push(data.price_cents); }
  if (data.trial_days !== undefined) { fields.push('trial_days = ?'); values.push(data.trial_days); }
  if (data.account_type !== undefined) { fields.push('account_type = ?'); values.push(data.account_type); }
  if (data.asaas_billing_type !== undefined) { fields.push('asaas_billing_type = ?'); values.push(data.asaas_billing_type); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }
  if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order); }

  if (fields.length === 0) return;

  values.push(id);
  await query(`UPDATE plans SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deletePlan(id: number): Promise<void> {
  // Soft delete
  await query(`UPDATE plans SET is_active = FALSE WHERE id = ?`, [id]);
}
