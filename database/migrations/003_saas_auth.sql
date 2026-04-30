-- ============================================================
-- 003 - Auth SaaS: usuarios, planos, assinaturas, OTP, configs
-- ============================================================
--
-- Fase 2: prepara o banco para signup publico, autenticacao por
-- telefone, planos com Asaas, OTP via WhatsApp (stub nesta fase),
-- configuracoes encriptadas e logs de mensagens.
--
-- Cada ADD COLUMN e idempotente via INFORMATION_SCHEMA + PREPARE.
-- DELIMITER nao funciona aqui (e instrucao do cliente, nao do servidor),
-- entao evitamos stored procedures.

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1) Estende users com novas colunas (idempotente)
-- ------------------------------------------------------------

-- phone_number
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone_number');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) NULL UNIQUE AFTER email',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cpf
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'cpf');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN cpf VARCHAR(11) NULL UNIQUE AFTER phone_number',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- phone_verified
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone_verified');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER cpf',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- email_verified
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER phone_verified',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- password_algo
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_algo');
SET @s := IF(@c = 0,
  "ALTER TABLE users ADD COLUMN password_algo ENUM('sha256', 'bcrypt') NOT NULL DEFAULT 'sha256' AFTER password",
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_status
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_status');
SET @s := IF(@c = 0,
  "ALTER TABLE users ADD COLUMN subscription_status ENUM('incomplete', 'trialing', 'active', 'overdue', 'blocked', 'cancelled', 'cortesia', 'admin') NULL AFTER is_active",
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_expires_at
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_expires_at');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME NULL AFTER subscription_status',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- current_subscription_id
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'current_subscription_id');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN current_subscription_id INT NULL AFTER subscription_expires_at',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- asaas_customer_id
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'asaas_customer_id');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN asaas_customer_id VARCHAR(100) NULL AFTER current_subscription_id',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- trial_used
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'trial_used');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN trial_used BOOLEAN NOT NULL DEFAULT FALSE AFTER asaas_customer_id',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cortesia_expires_at
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'cortesia_expires_at');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN cortesia_expires_at DATETIME NULL AFTER trial_used',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Marca o admin atual com status='admin' (uma unica vez)
UPDATE users SET subscription_status = 'admin'
  WHERE role = 'admin' AND subscription_status IS NULL;

-- ------------------------------------------------------------
-- 2) plans
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  price_cents INT NOT NULL,
  trial_days INT NOT NULL DEFAULT 0,
  asaas_billing_type VARCHAR(20) NOT NULL DEFAULT 'CREDIT_CARD',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_plans_active (is_active),
  INDEX idx_plans_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3) subscriptions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  asaas_subscription_id VARCHAR(100) NULL,
  status ENUM('trialing', 'active', 'overdue', 'blocked', 'cancelled') NOT NULL DEFAULT 'trialing',
  started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  current_period_end DATETIME NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id),
  INDEX idx_subscriptions_user (user_id),
  INDEX idx_subscriptions_status (status),
  INDEX idx_subscriptions_asaas (asaas_subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4) payments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  asaas_payment_id VARCHAR(100) NULL,
  amount_cents INT NOT NULL,
  status ENUM('pending', 'confirmed', 'received', 'overdue', 'refunded', 'cancelled') NOT NULL DEFAULT 'pending',
  due_date DATE NULL,
  paid_at DATETIME NULL,
  payment_method VARCHAR(30) NULL,
  raw_payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  INDEX idx_payments_subscription (subscription_id),
  INDEX idx_payments_status (status),
  INDEX idx_payments_asaas (asaas_payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5) otp_codes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  purpose ENUM('signup', 'login', 'reset_password', 'change_phone') NOT NULL,
  attempts TINYINT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_otp_phone_purpose (phone, purpose),
  INDEX idx_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6) pending_actions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  payload JSON NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_pending_user_type (user_id, type),
  INDEX idx_pending_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 7) system_config
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_config (
  `key` VARCHAR(100) PRIMARY KEY,
  value_encrypted TEXT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  description VARCHAR(500) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 8) user_preferences
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INT PRIMARY KEY,
  preferences JSON NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 9) processed_webhooks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_webhooks (
  event_id VARCHAR(100) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_webhook_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 10) message_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  channel VARCHAR(20) NOT NULL,
  direction ENUM('in', 'out') NOT NULL,
  phone VARCHAR(20) NULL,
  content TEXT NULL,
  status VARCHAR(30) NULL,
  error TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_msglog_user (user_id),
  INDEX idx_msglog_phone (phone),
  INDEX idx_msglog_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
