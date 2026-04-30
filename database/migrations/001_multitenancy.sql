-- ============================================================
-- 001 - Multi-tenancy: adiciona user_id, limpa dados, ajusta FKs
--
-- Fase 1 da migracao para SaaS. Apaga todos os lancamentos atuais
-- (mantem apenas usuarios e categorias). As categorias atuais
-- viram template (user_id NULL) e serao clonadas no signup.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1) Apaga lancamentos antigos (preserva apenas users + categorias)
-- ------------------------------------------------------------
TRUNCATE TABLE transactions;
TRUNCATE TABLE bills;
TRUNCATE TABLE savings_box_transactions;
TRUNCATE TABLE savings_boxes;
TRUNCATE TABLE budgets;
TRUNCATE TABLE monthly_budget_items;
TRUNCATE TABLE monthly_budgets;

-- asset_movements pode nao existir ainda (e criada lazy pelo codigo)
CREATE TABLE IF NOT EXISTS asset_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NOT NULL,
  date DATE NOT NULL,
  movement_type ENUM('entry', 'exit', 'dividend') NOT NULL,
  quantity DECIMAL(18, 2) NOT NULL,
  price DECIMAL(18, 2) NOT NULL,
  total DECIMAL(18, 2) NOT NULL,
  fee_rate DECIMAL(5, 2) DEFAULT 0,
  total_after_fee DECIMAL(18, 2) NOT NULL,
  current_price DECIMAL(18, 2) NULL,
  profit DECIMAL(18, 2) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES investments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE asset_movements;
TRUNCATE TABLE investments;

-- ------------------------------------------------------------
-- 2) Drop tabelas nao usadas
-- ------------------------------------------------------------
DROP TABLE IF EXISTS cash_accounts;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS investment_transactions;

-- ------------------------------------------------------------
-- 3) categories: user_id NULL = template (linhas seed atuais)
-- ------------------------------------------------------------
ALTER TABLE categories
  ADD COLUMN user_id INT NULL AFTER id,
  DROP INDEX uk_category_name_type,
  ADD UNIQUE KEY uk_category_user_name_type (user_id, name, type),
  ADD INDEX idx_categories_user (user_id),
  ADD CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ------------------------------------------------------------
-- 4) Demais tabelas: user_id NOT NULL (apos truncate, seguro)
-- ------------------------------------------------------------
ALTER TABLE transactions
  ADD COLUMN user_id INT NOT NULL AFTER id,
  ADD INDEX idx_transactions_user (user_id),
  ADD CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE bills
  ADD COLUMN user_id INT NOT NULL AFTER id,
  ADD INDEX idx_bills_user (user_id),
  ADD CONSTRAINT fk_bills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE savings_boxes
  ADD COLUMN user_id INT NOT NULL AFTER id,
  DROP INDEX uk_savings_box_name,
  ADD UNIQUE KEY uk_savings_box_user_name (user_id, name),
  ADD INDEX idx_savings_boxes_user (user_id),
  ADD CONSTRAINT fk_savings_boxes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE savings_box_transactions
  ADD COLUMN user_id INT NOT NULL AFTER id,
  ADD INDEX idx_sbt_user (user_id),
  ADD CONSTRAINT fk_sbt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE investments
  ADD COLUMN user_id INT NOT NULL AFTER id,
  ADD INDEX idx_investments_user (user_id),
  ADD CONSTRAINT fk_investments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE asset_movements
  ADD COLUMN user_id INT NOT NULL AFTER id,
  ADD INDEX idx_am_user (user_id),
  ADD CONSTRAINT fk_am_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE budgets
  ADD COLUMN user_id INT NOT NULL AFTER id,
  DROP INDEX uk_budget_category_period,
  ADD UNIQUE KEY uk_budget_user_category_period (user_id, category_id, month, year),
  ADD INDEX idx_budgets_user (user_id),
  ADD CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE monthly_budgets
  ADD COLUMN user_id INT NOT NULL AFTER id,
  DROP INDEX uk_monthly_budget_period,
  ADD UNIQUE KEY uk_mb_user_period (user_id, year, month),
  ADD INDEX idx_mb_user (user_id),
  ADD CONSTRAINT fk_mb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE monthly_budget_items
  ADD COLUMN user_id INT NOT NULL AFTER id,
  ADD INDEX idx_mbi_user (user_id),
  ADD CONSTRAINT fk_mbi_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ------------------------------------------------------------
-- 5) Renomeia transactions.telegram_message_id -> external_message_id
-- ------------------------------------------------------------
ALTER TABLE transactions
  CHANGE COLUMN telegram_message_id external_message_id BIGINT NULL;

SET FOREIGN_KEY_CHECKS = 1;
