CREATE DATABASE IF NOT EXISTS opinion_monitor DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE opinion_monitor;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(128) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `real_name` VARCHAR(64) NULL,
  `id_card_hash` VARCHAR(128) NULL,
  `auth_status` ENUM('unverified', 'verified', 'banned') NOT NULL DEFAULT 'unverified',
  `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  `first_login` TINYINT NOT NULL DEFAULT 1,
  `login_attempts` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX `uniq_users_username` (`username`),
  UNIQUE INDEX `uniq_users_phone` (`phone`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `aliyun_configs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `config_type` VARCHAR(32) NOT NULL,
  `access_key` TEXT NOT NULL,
  `secret_key` TEXT NOT NULL,
  `sign_name` VARCHAR(64) NULL,
  `template_code` VARCHAR(64) NULL,
  `product_code` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uniq_config_type` (`config_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `monitor_tasks` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `keywords` TEXT NOT NULL,
  `exclude_keywords` TEXT NULL,
  `platforms` JSON NOT NULL,
  `match_mode` ENUM('exact', 'fuzzy', 'both') NOT NULL DEFAULT 'both',
  `sentiment_filter` ENUM('all', 'positive', 'negative') NOT NULL DEFAULT 'all',
  `min_read_threshold` INT NOT NULL DEFAULT 0,
  `min_like_threshold` INT NOT NULL DEFAULT 0,
  `frequency` ENUM('5min', '15min', '30min', '60min') NOT NULL DEFAULT '15min',
  `status` ENUM('enabled', 'paused', 'error') NOT NULL DEFAULT 'enabled',
  `last_run_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_monitor_tasks_user_id` (`user_id`),
  INDEX `idx_monitor_tasks_user_status` (`user_id`, `status`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `opinion_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `task_id` BIGINT NOT NULL,
  `platform` VARCHAR(32) NOT NULL,
  `title` VARCHAR(512) NOT NULL,
  `content` TEXT NOT NULL,
  `summary` TEXT NOT NULL,
  `author` VARCHAR(128) NOT NULL,
  `author_avatar` VARCHAR(512) NULL,
  `publish_time` DATETIME NOT NULL,
  `url` VARCHAR(512) NOT NULL,
  `read_count` INT NOT NULL DEFAULT 0,
  `like_count` INT NOT NULL DEFAULT 0,
  `comment_count` INT NOT NULL DEFAULT 0,
  `share_count` INT NOT NULL DEFAULT 0,
  `sentiment` ENUM('positive', 'negative', 'neutral') NOT NULL DEFAULT 'neutral',
  `matched_keywords` JSON NOT NULL,
  `raw_data` JSON NOT NULL,
  `status` INT NOT NULL DEFAULT 0,
  `matched_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_task_time` (`task_id`, `matched_at`),
  INDEX `idx_publish_time` (`publish_time`),
  INDEX `idx_opinion_events_task_id` (`task_id`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `webhooks` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `url` VARCHAR(512) NOT NULL,
  `format` ENUM('wecom', 'dingtalk', 'feishu', 'custom_json') NOT NULL DEFAULT 'custom_json',
  `secret_key` VARCHAR(128) NULL,
  `ingest_token` VARCHAR(128) NOT NULL,
  `sms_alert_enabled` TINYINT NOT NULL DEFAULT 0,
  `push_on_match` TINYINT NOT NULL DEFAULT 1,
  `push_periodic` TINYINT NOT NULL DEFAULT 0,
  `periodic_freq` ENUM('hourly', 'every_6h', 'daily') NULL,
  `periodic_time` VARCHAR(8) NULL,
  `last_push_at` DATETIME NULL,
  `status` ENUM('active', 'error', 'disabled') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_webhooks_user_id` (`user_id`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `webhook_task_bindings` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `webhook_id` BIGINT NOT NULL,
  `task_id` BIGINT NOT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `uniq_webhook_task` (`webhook_id`, `task_id`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `webhook_push_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `webhook_id` BIGINT NOT NULL,
  `event_id` BIGINT NULL,
  `http_status` INT NOT NULL,
  `response_body` TEXT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `result` ENUM('success', 'failed', 'timeout') NOT NULL,
  `duration_ms` DECIMAL(10,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_webhook_push_logs_webhook_id` (`webhook_id`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sms_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `scene` ENUM('login', 'register', 'reset', 'notify', 'alert') NOT NULL,
  `template_code` VARCHAR(64) NOT NULL,
  `status` ENUM('sent', 'success', 'failed') NOT NULL,
  `error_code` VARCHAR(64) NULL,
  `error_message` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_phone_time` (`phone`, `created_at`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `operator_id` BIGINT NULL,
  `level` ENUM('info', 'warn', 'error') NOT NULL DEFAULT 'info',
  `module` VARCHAR(64) NOT NULL,
  `action` VARCHAR(128) NOT NULL,
  `detail` TEXT NULL,
  `ip_address` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_module_time` (`module`, `created_at`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 智能体管理模块
CREATE TABLE IF NOT EXISTS `agents` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL,
  `role_description` VARCHAR(512) NOT NULL,
  `system_prompt` TEXT NULL,
  `primary_model_id` BIGINT NOT NULL,
  `fallback_model_ids` JSON NOT NULL,
  `temperature` FLOAT NOT NULL DEFAULT 0.7,
  `max_tokens` INT NOT NULL DEFAULT 2048,
  `kb_enabled` TINYINT NOT NULL DEFAULT 1,
  `kb_top_k` INT NOT NULL DEFAULT 4,
  `status` ENUM('enabled','disabled') NOT NULL DEFAULT 'enabled',
  `avatar` VARCHAR(128) NULL,
  `description` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_agents_status` (`status`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `llm_models` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `provider` VARCHAR(32) NOT NULL,
  `model` VARCHAR(64) NOT NULL,
  `display_name` VARCHAR(128) NOT NULL,
  `base_url` VARCHAR(512) NOT NULL,
  `api_key_enc` TEXT NOT NULL,
  `api_version` VARCHAR(16) NOT NULL DEFAULT '1.0',
  `max_tokens` INT NOT NULL DEFAULT 4096,
  `is_preset` TINYINT NOT NULL DEFAULT 0,
  `is_enabled` TINYINT NOT NULL DEFAULT 1,
  `last_tested_at` DATETIME NULL,
  `last_test_status` VARCHAR(32) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_llm_models_provider` (`provider`),
  INDEX `idx_llm_models_enabled` (`is_enabled`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agent_kb_files` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `agent_id` BIGINT NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `file_type` VARCHAR(16) NOT NULL,
  `file_size` INT NOT NULL,
  `storage_path` VARCHAR(512) NOT NULL,
  `chunk_count` INT NOT NULL DEFAULT 0,
  `total_chars` INT NOT NULL DEFAULT 0,
  `status` ENUM('pending','parsing','ready','failed') NOT NULL DEFAULT 'pending',
  `error_message` TEXT NULL,
  `uploaded_by` BIGINT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_agent_kb_files_agent` (`agent_id`),
  INDEX `idx_agent_kb_files_status` (`status`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agent_kb_chunks` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `file_id` BIGINT NOT NULL,
  `agent_id` BIGINT NOT NULL,
  `chunk_index` INT NOT NULL,
  `content` TEXT NOT NULL,
  `char_count` INT NOT NULL,
  `embedding_b64` MEDIUMTEXT NOT NULL,
  `metadata` VARCHAR(128) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_agent_kb_chunks_agent` (`agent_id`, `file_id`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pr_reports` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `event_id` BIGINT NULL,
  `agent_id` BIGINT NULL,
  `input_snapshot` TEXT NULL,
  `analysis` MEDIUMTEXT NULL,
  `strategy` MEDIUMTEXT NULL,
  `model_used` VARCHAR(128) NULL,
  `tokens_used` INT NOT NULL DEFAULT 0,
  `latency_ms` INT NOT NULL DEFAULT 0,
  `status` ENUM('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
  `error_message` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pr_reports_user` (`user_id`, `created_at`),
  INDEX `idx_pr_reports_status` (`status`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 短信模板管理
CREATE TABLE IF NOT EXISTS `sms_templates` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `scene` ENUM('login','register','reset_password','opinion_alert','ban_notify','unban_notify','generic') NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `sign_name` VARCHAR(64) NOT NULL,
  `template_code` VARCHAR(64) NULL,
  `template_content` TEXT NOT NULL,
  `variables` JSON NULL,
  `is_default` TINYINT NOT NULL DEFAULT 0,
  `remark` VARCHAR(256) NULL,
  `status` ENUM('draft','pending_review','approved','rejected','disabled') NOT NULL DEFAULT 'draft',
  `reject_reason` VARCHAR(512) NULL,
  `submitted_at` DATETIME NULL,
  `approved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sms_templates_scene` (`scene`),
  INDEX `idx_sms_templates_default` (`scene`, `is_default`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_deleted` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `original_user_id` BIGINT NOT NULL,
  `username` VARCHAR(64) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `deleted_by` BIGINT NOT NULL,
  `deleted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_deleted_phone` (`phone`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE aliyun_configs 
  ADD COLUMN endpoint_type ENUM('common','beijing','shanghai') NOT NULL DEFAULT 'common' AFTER config_type,
  ADD COLUMN param_type ENUM('normal','md5','sm2') NOT NULL DEFAULT 'md5' AFTER endpoint_type,
  ADD COLUMN region VARCHAR(64) NULL DEFAULT NULL AFTER param_type;
