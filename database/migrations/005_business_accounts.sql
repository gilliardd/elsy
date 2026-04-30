-- ============================================================
-- 005 - Contas PJ (MEI/empresa) e modulos de gestao
-- ============================================================
--
-- Adiciona suporte a contas PJ (account_type='business') com modulos
-- de clientes, servicos, recebiveis e caixa. Usuarios PF continuam
-- funcionando como antes (default account_type='personal').

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1) users: account_type, business_name, cnpj
-- ------------------------------------------------------------

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'account_type');
SET @s := IF(@c = 0,
  "ALTER TABLE users ADD COLUMN account_type ENUM('personal', 'business') NOT NULL DEFAULT 'personal' AFTER role",
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'business_name');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN business_name VARCHAR(200) NULL AFTER account_type',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'cnpj');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN cnpj VARCHAR(14) NULL UNIQUE AFTER business_name',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 2) plans: account_type
-- ------------------------------------------------------------

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'account_type');
SET @s := IF(@c = 0,
  "ALTER TABLE plans ADD COLUMN account_type ENUM('personal', 'business', 'any') NOT NULL DEFAULT 'any' AFTER trial_days",
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 3) customers (clientes do PJ)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(200) NULL,
  cpf_cnpj VARCHAR(14) NULL,
  notes TEXT NULL,
  total_billed_cents INT NOT NULL DEFAULT 0,
  total_paid_cents INT NOT NULL DEFAULT 0,
  last_visit_at DATETIME NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_customers_user (user_id),
  INDEX idx_customers_user_name (user_id, name),
  INDEX idx_customers_user_phone (user_id, phone),
  INDEX idx_customers_active (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4) services (catalogo do PJ)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  price_cents INT NOT NULL,
  duration_minutes INT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_services_user_name (user_id, name),
  INDEX idx_services_user_active (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5) receivables (contas a receber)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receivables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  customer_id INT NOT NULL,
  service_id INT NULL,
  amount_cents INT NOT NULL,
  description VARCHAR(500) NULL,
  due_date DATE NOT NULL,
  status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  payment_method VARCHAR(50) NULL,
  notes TEXT NULL,
  -- snooze: data ate quando o lembrete fica suprimido (cliente disse "pago a noite")
  snooze_until DATE NULL,
  last_reminder_at DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  INDEX idx_recv_user_status (user_id, status),
  INDEX idx_recv_user_due (user_id, due_date),
  INDEX idx_recv_customer (customer_id),
  INDEX idx_recv_pending_due (status, due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6) cash_movements (caixa diario: entradas e saidas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('in', 'out') NOT NULL,
  amount_cents INT NOT NULL,
  description VARCHAR(500) NULL,
  receivable_id INT NULL,
  transaction_id INT NULL,
  category_id INT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receivable_id) REFERENCES receivables(id) ON DELETE SET NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_cash_user_date (user_id, date),
  INDEX idx_cash_user_type_date (user_id, type, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
