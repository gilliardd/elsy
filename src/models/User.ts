import { query } from '../config/database';
import { hashPasswordBcrypt, hashPasswordSha256, verifyPassword } from '../utils/password';

export type UserRole = 'admin' | 'user' | 'viewer';
export type SubscriptionStatus =
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'overdue'
  | 'blocked'
  | 'cancelled'
  | 'cortesia'
  | 'admin';

export interface User {
  id: number;
  username: string;
  password: string;
  password_algo: 'sha256' | 'bcrypt';
  name: string;
  email: string | null;
  phone_number: string | null;
  cpf: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  role: UserRole;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  is_active: boolean;
  subscription_status: SubscriptionStatus | null;
  subscription_expires_at: Date | null;
  current_subscription_id: number | null;
  asaas_customer_id: string | null;
  trial_used: boolean;
  cortesia_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type UserWithoutPassword = Omit<User, 'password' | 'password_algo'>;

function stripPassword(user: User): UserWithoutPassword {
  const { password: _p, password_algo: _a, ...rest } = user;
  return rest;
}

// ------------------------------------------------------------
// Lookups
// ------------------------------------------------------------

export async function getUserById(id: number): Promise<UserWithoutPassword | null> {
  const rows = await query<User[]>(
    `SELECT * FROM users WHERE id = ? AND is_active = TRUE`,
    [id]
  );
  return rows[0] ? stripPassword(rows[0]) : null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const rows = await query<User[]>(
    `SELECT * FROM users WHERE username = ? AND is_active = TRUE`,
    [username]
  );
  return rows[0] || null;
}

export async function getUserByPhone(phone: string): Promise<User | null> {
  const rows = await query<User[]>(
    `SELECT * FROM users WHERE phone_number = ? AND is_active = TRUE`,
    [phone]
  );
  return rows[0] || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await query<User[]>(
    `SELECT * FROM users WHERE email = ? AND is_active = TRUE`,
    [email]
  );
  return rows[0] || null;
}

export async function getUserByCpf(cpf: string): Promise<User | null> {
  const rows = await query<User[]>(
    `SELECT * FROM users WHERE cpf = ? AND is_active = TRUE`,
    [cpf]
  );
  return rows[0] || null;
}

export async function getAllUsers(): Promise<UserWithoutPassword[]> {
  const rows = await query<User[]>(
    `SELECT * FROM users WHERE is_active = TRUE ORDER BY name`
  );
  return rows.map(stripPassword);
}

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------

// Autentica admin via username + senha. Re-hash transparente para bcrypt
// quando a senha estava em SHA-256 (Fase 1 -> Fase 2).
export async function authenticateAdmin(
  username: string,
  password: string
): Promise<UserWithoutPassword | null> {
  const user = await getUserByUsername(username);
  if (!user || user.role !== 'admin') return null;

  const { valid, needsRehash } = verifyPassword(password, user.password, user.password_algo);
  if (!valid) return null;

  if (needsRehash) {
    await query(
      `UPDATE users SET password = ?, password_algo = 'bcrypt' WHERE id = ?`,
      [hashPasswordBcrypt(password), user.id]
    );
  }

  return stripPassword(user);
}

// Autentica usuario comum via telefone + senha.
export async function authenticateUser(
  phone: string,
  password: string
): Promise<UserWithoutPassword | null> {
  const user = await getUserByPhone(phone);
  if (!user || user.role === 'admin') return null;

  const { valid, needsRehash } = verifyPassword(password, user.password, user.password_algo);
  if (!valid) return null;

  if (needsRehash) {
    await query(
      `UPDATE users SET password = ?, password_algo = 'bcrypt' WHERE id = ?`,
      [hashPasswordBcrypt(password), user.id]
    );
  }

  return stripPassword(user);
}

// ------------------------------------------------------------
// Mutations
// ------------------------------------------------------------

export interface CreateAdminDTO {
  username: string;
  password: string;
  name: string;
  email?: string;
}

export async function createAdmin(data: CreateAdminDTO): Promise<number> {
  const existing = await getUserByUsername(data.username);
  if (existing) throw new Error('Username already exists');

  const result = await query<any>(
    `INSERT INTO users (username, password, password_algo, name, email, role,
                        can_create, can_edit, can_delete, subscription_status)
     VALUES (?, ?, 'bcrypt', ?, ?, 'admin', TRUE, TRUE, TRUE, 'admin')`,
    [data.username, hashPasswordBcrypt(data.password), data.name, data.email || null]
  );
  return result.insertId;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  phone_number: string;
  cpf: string;
  password: string;
}

// Cria usuario novo (signup). Usa username = email para satisfazer a coluna
// UNIQUE legada. O login dos usuarios comuns e por telefone.
export async function createUser(data: CreateUserDTO): Promise<number> {
  if (await getUserByPhone(data.phone_number)) {
    throw new Error('Phone already in use');
  }
  if (await getUserByEmail(data.email)) {
    throw new Error('Email already in use');
  }
  if (await getUserByCpf(data.cpf)) {
    throw new Error('CPF already in use');
  }
  if (await getUserByUsername(data.email)) {
    throw new Error('Username already in use');
  }

  const result = await query<any>(
    `INSERT INTO users (username, password, password_algo, name, email,
                        phone_number, cpf, role,
                        can_create, can_edit, can_delete, subscription_status,
                        phone_verified, email_verified)
     VALUES (?, ?, 'bcrypt', ?, ?, ?, ?, 'user', TRUE, TRUE, FALSE,
             'incomplete', FALSE, FALSE)`,
    [
      data.email,
      hashPasswordBcrypt(data.password),
      data.name,
      data.email,
      data.phone_number,
      data.cpf,
    ]
  );
  return result.insertId;
}

export async function setPhoneVerified(userId: number, verified: boolean): Promise<void> {
  await query(`UPDATE users SET phone_verified = ? WHERE id = ?`, [verified, userId]);
}

export async function setEmailVerified(userId: number, verified: boolean): Promise<void> {
  await query(`UPDATE users SET email_verified = ? WHERE id = ?`, [verified, userId]);
}

export async function updatePassword(userId: number, newPassword: string): Promise<void> {
  await query(
    `UPDATE users SET password = ?, password_algo = 'bcrypt' WHERE id = ?`,
    [hashPasswordBcrypt(newPassword), userId]
  );
}

export async function updatePhone(userId: number, newPhone: string): Promise<void> {
  if (await getUserByPhone(newPhone)) {
    throw new Error('Phone already in use');
  }
  await query(
    `UPDATE users SET phone_number = ?, phone_verified = TRUE WHERE id = ?`,
    [newPhone, userId]
  );
}

export async function updateProfile(
  userId: number,
  data: { name?: string; email?: string }
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.email !== undefined) {
    fields.push('email = ?');
    values.push(data.email);
  }

  if (fields.length === 0) return;

  values.push(userId);
  await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function setSubscriptionStatus(
  userId: number,
  status: SubscriptionStatus,
  expiresAt: Date | null = null,
  subscriptionId: number | null = null
): Promise<void> {
  await query(
    `UPDATE users SET subscription_status = ?, subscription_expires_at = ?,
                      current_subscription_id = COALESCE(?, current_subscription_id)
     WHERE id = ?`,
    [status, expiresAt, subscriptionId, userId]
  );
}

export async function setAsaasCustomerId(userId: number, asaasId: string): Promise<void> {
  await query(`UPDATE users SET asaas_customer_id = ? WHERE id = ?`, [asaasId, userId]);
}

export async function markTrialUsed(userId: number): Promise<void> {
  await query(`UPDATE users SET trial_used = TRUE WHERE id = ?`, [userId]);
}

export async function deleteUser(id: number): Promise<void> {
  await query(`UPDATE users SET is_active = FALSE WHERE id = ?`, [id]);
}

// ------------------------------------------------------------
// Bootstrap admin (mantido para compatibilidade — cria admin
// padrao se nao existir nenhum)
// ------------------------------------------------------------

export async function ensureAdminExists(): Promise<void> {
  const admins = await query<User[]>(
    `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE LIMIT 1`
  );
  if (admins.length > 0) return;

  await createAdmin({
    username: 'admin',
    password: 'admin123',
    name: 'Administrador',
    email: 'admin@elsy.com.br',
  });
  console.log('Default admin user created: admin / admin123');
}

// Verifica a senha atual de um usuario pelo id. Faz re-hash transparente
// caso o algoritmo legado (SHA-256) seja detectado.
export async function verifyUserPasswordById(
  userId: number,
  password: string
): Promise<boolean> {
  const rows = await query<{ password: string; password_algo: 'sha256' | 'bcrypt' }[]>(
    `SELECT password, password_algo FROM users WHERE id = ? AND is_active = TRUE`,
    [userId]
  );
  if (rows.length === 0) return false;

  const { valid, needsRehash } = verifyPassword(password, rows[0].password, rows[0].password_algo);
  if (!valid) return false;

  if (needsRehash) {
    await query(
      `UPDATE users SET password = ?, password_algo = 'bcrypt' WHERE id = ?`,
      [hashPasswordBcrypt(password), userId]
    );
  }

  return true;
}

// Helpers de migracao SHA-256 -> bcrypt usados em testes/scripts.
export { hashPasswordBcrypt, hashPasswordSha256 };
