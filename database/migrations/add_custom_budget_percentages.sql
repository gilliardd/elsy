-- Migration: Adiciona suporte a percentuais customizados em orcamentos
-- Data: 2026-02-04
--
-- Tornada idempotente em 2026-04-30 porque as mesmas colunas e o valor
-- 'custom' do ENUM tambem entraram no schema.sql. Em bancos novos as
-- colunas ja existem; aqui garantimos que a migration roda sem erro
-- independente do estado anterior.

-- Garante 'custom' no ENUM (MODIFY e idempotente)
ALTER TABLE monthly_budgets
MODIFY COLUMN rule ENUM('50-30-20', '60-20-20', '40-30-30', 'custom') NOT NULL DEFAULT '50-30-20';

-- Adiciona custom_necessidades se ainda nao existir
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'monthly_budgets' AND COLUMN_NAME = 'custom_necessidades');
SET @sql := IF(@col = 0,
  'ALTER TABLE monthly_budgets ADD COLUMN custom_necessidades INT DEFAULT NULL AFTER expected_income',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Adiciona custom_estilo_vida se ainda nao existir
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'monthly_budgets' AND COLUMN_NAME = 'custom_estilo_vida');
SET @sql := IF(@col = 0,
  'ALTER TABLE monthly_budgets ADD COLUMN custom_estilo_vida INT DEFAULT NULL AFTER custom_necessidades',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Adiciona custom_futuro se ainda nao existir
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'monthly_budgets' AND COLUMN_NAME = 'custom_futuro');
SET @sql := IF(@col = 0,
  'ALTER TABLE monthly_budgets ADD COLUMN custom_futuro INT DEFAULT NULL AFTER custom_estilo_vida',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
