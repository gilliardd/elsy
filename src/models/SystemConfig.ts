import { query } from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';

export interface SystemConfig {
  key: string;
  value_encrypted: string | null;
  is_secret: boolean;
  description: string | null;
  updated_at: Date;
}

// Salva (e encripta) um valor de configuracao. Tudo passa por encrypt
// para uniformidade — mesmo valores nao-secretos ficam encriptados,
// simplificando a API.
export async function setConfig(key: string, value: string, isSecret = false, description: string | null = null): Promise<void> {
  const encrypted = encrypt(value);
  await query(
    `INSERT INTO system_config (\`key\`, value_encrypted, is_secret, description)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       value_encrypted = VALUES(value_encrypted),
       is_secret = VALUES(is_secret),
       description = COALESCE(VALUES(description), description)`,
    [key, encrypted, isSecret, description]
  );
}

export async function getConfig(key: string): Promise<string | null> {
  const rows = await query<SystemConfig[]>(
    `SELECT * FROM system_config WHERE \`key\` = ?`,
    [key]
  );
  if (rows.length === 0 || !rows[0].value_encrypted) return null;
  try {
    return decrypt(rows[0].value_encrypted);
  } catch {
    return null;
  }
}

// Lista chaves disponiveis. Para is_secret=true, mascara o valor.
export async function listConfig(): Promise<{ key: string; value: string; is_secret: boolean; description: string | null }[]> {
  const rows = await query<SystemConfig[]>(`SELECT * FROM system_config ORDER BY \`key\``);
  return rows.map((r) => {
    let value = '';
    if (r.value_encrypted) {
      try {
        const dec = decrypt(r.value_encrypted);
        value = r.is_secret ? '••••••' + dec.slice(-4) : dec;
      } catch {
        value = '';
      }
    }
    return { key: r.key, value, is_secret: r.is_secret, description: r.description };
  });
}

export async function deleteConfig(key: string): Promise<void> {
  await query(`DELETE FROM system_config WHERE \`key\` = ?`, [key]);
}
