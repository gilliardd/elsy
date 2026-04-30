-- ============================================================
-- 004 - Tracking de overdue para o scheduler de cobranca
-- ============================================================
--
-- Adiciona overdue_since em subscriptions para que o scheduler saiba
-- por quanto tempo a assinatura esta em overdue (D+0, D+3, D+7, D+30).

-- subscriptions.overdue_since
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'overdue_since');
SET @s := IF(@c = 0,
  'ALTER TABLE subscriptions ADD COLUMN overdue_since DATETIME NULL AFTER current_period_end',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.last_overdue_notice_at — controla cadencia de avisos
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'last_overdue_notice_at');
SET @s := IF(@c = 0,
  'ALTER TABLE subscriptions ADD COLUMN last_overdue_notice_at DATETIME NULL AFTER overdue_since',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Indices para o scheduler e o gate
SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND INDEX_NAME = 'idx_sub_overdue');
SET @s := IF(@c = 0,
  'ALTER TABLE subscriptions ADD INDEX idx_sub_overdue (status, overdue_since)',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_user_sub_status');
SET @s := IF(@c = 0,
  'ALTER TABLE users ADD INDEX idx_user_sub_status (subscription_status)',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
