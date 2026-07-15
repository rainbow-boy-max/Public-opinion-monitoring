-- Phase 1: Alter existing tables (add missing columns)
ALTER TABLE opinion_events
  ADD COLUMN IF NOT EXISTS `sentiment_score` DECIMAL(5,2) NULL AFTER `sentiment`,
  ADD COLUMN IF NOT EXISTS `sentiment_confidence` DECIMAL(5,2) NULL AFTER `sentiment_score`,
  ADD COLUMN IF NOT EXISTS `sentiment_source` VARCHAR(16) NULL AFTER `sentiment_confidence`;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS `tenant_id` BIGINT NULL AFTER `role`;

ALTER TABLE monitor_tasks
  ADD COLUMN IF NOT EXISTS `tenant_id` BIGINT NULL AFTER `user_id`;

ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS `tenant_id` BIGINT NULL AFTER `user_id`;

ALTER TABLE pr_reports
  ADD COLUMN IF NOT EXISTS `audio_url` VARCHAR(512) NULL AFTER `error_message`,
  ADD COLUMN IF NOT EXISTS `audio_duration_ms` INT NULL AFTER `audio_url`,
  ADD COLUMN IF NOT EXISTS `report_type` VARCHAR(16) DEFAULT 'single' AFTER `user_id`,
  ADD COLUMN IF NOT EXISTS `periodic_freq` VARCHAR(16) NULL AFTER `report_type`,
  ADD COLUMN IF NOT EXISTS `periodic_config` TEXT NULL AFTER `periodic_freq`,
  ADD COLUMN IF NOT EXISTS `export_format` VARCHAR(16) DEFAULT 'markdown' AFTER `periodic_config`,
  ADD COLUMN IF NOT EXISTS `export_url` VARCHAR(512) NULL AFTER `export_format`;

-- Phase 2: Create new tables
CREATE TABLE IF NOT EXISTS `propagation_links` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `source_event_id` BIGINT NOT NULL,
  `target_event_id` BIGINT NOT NULL,
  `source_platform` VARCHAR(32) NOT NULL,
  `target_platform` VARCHAR(32) NOT NULL,
  `similarity` DECIMAL(5,2) DEFAULT 0,
  `relation_type` VARCHAR(32) DEFAULT 'repost',
  `detected_at` DATETIME NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_prop_source` (`source_event_id`),
  INDEX `idx_prop_target` (`target_event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `alert_rules` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `description` TEXT NULL,
  `condition_type` VARCHAR(32) NOT NULL,
  `condition_config` TEXT NOT NULL,
  `channel` VARCHAR(32) NOT NULL,
  `channel_config` TEXT NULL,
  `status` VARCHAR(16) DEFAULT 'active',
  `last_triggered_at` DATETIME NULL,
  `cooldown_minutes` INT DEFAULT 60,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_alert_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `alert_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `rule_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `title` VARCHAR(256) NOT NULL,
  `message` TEXT NULL,
  `trigger_data` TEXT NULL,
  `status` VARCHAR(16) DEFAULT 'sent',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_alert_log_rule` (`rule_id`),
  INDEX `idx_alert_log_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `competitor_groups` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `description` TEXT NULL,
  `competitors` TEXT NOT NULL,
  `is_active` TINYINT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_cg_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `report_schedules` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `freq` VARCHAR(16) NOT NULL,
  `task_ids` TEXT NOT NULL,
  `time` VARCHAR(5) NOT NULL,
  `next_run_at` DATETIME NULL,
  `is_active` TINYINT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `custom_dashboards` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `layout` TEXT NOT NULL,
  `widgets` TEXT NOT NULL,
  `is_default` TINYINT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `short_videos` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `task_id` BIGINT NOT NULL,
  `platform` VARCHAR(32) NOT NULL,
  `title` VARCHAR(512) NOT NULL,
  `author` VARCHAR(128) NOT NULL,
  `author_avatar` VARCHAR(512) NULL,
  `video_url` VARCHAR(512) NOT NULL,
  `cover_url` VARCHAR(512) NULL,
  `duration_seconds` INT DEFAULT 0,
  `play_count` INT DEFAULT 0,
  `like_count` INT DEFAULT 0,
  `comment_count` INT DEFAULT 0,
  `share_count` INT DEFAULT 0,
  `collect_count` INT DEFAULT 0,
  `description` TEXT NULL,
  `comments` TEXT NULL,
  `sentiment` VARCHAR(16) DEFAULT 'neutral',
  `hashtags` TEXT NULL,
  `published_at` DATETIME NOT NULL,
  `matched_at` DATETIME NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sv_task` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tenants` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(128) NOT NULL,
  `slug` VARCHAR(64) NOT NULL UNIQUE,
  `settings` TEXT NULL,
  `max_users` INT DEFAULT 10,
  `is_active` TINYINT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `agent_templates` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(128) NOT NULL,
  `description` VARCHAR(256) NOT NULL,
  `system_prompt` TEXT NOT NULL,
  `capabilities` TEXT NOT NULL,
  `suggested_model` VARCHAR(64) NULL,
  `icon` VARCHAR(64) DEFAULT 'robot',
  `category` VARCHAR(32) NOT NULL,
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `work_orders` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `assigned_to` BIGINT NULL,
  `type` VARCHAR(32) NOT NULL,
  `event_id` BIGINT NULL,
  `title` VARCHAR(256) NOT NULL,
  `description` TEXT NOT NULL,
  `priority` VARCHAR(16) DEFAULT 'medium',
  `status` VARCHAR(16) DEFAULT 'pending',
  `analysis` TEXT NULL,
  `resolution` TEXT NULL,
  `resolution_type` VARCHAR(32) NULL,
  `due_at` DATETIME NULL,
  `resolved_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_wo_user` (`user_id`),
  INDEX `idx_wo_assigned` (`assigned_to`),
  INDEX `idx_wo_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `work_order_comments` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_woc_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
