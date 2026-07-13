import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`username\` VARCHAR(64) NOT NULL,
        \`password_hash\` VARCHAR(128) NOT NULL,
        \`phone\` VARCHAR(20) NOT NULL,
        \`real_name\` VARCHAR(64) NULL,
        \`id_card_hash\` VARCHAR(128) NULL,
        \`auth_status\` ENUM('unverified', 'verified', 'banned') NOT NULL DEFAULT 'unverified',
        \`role\` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
        \`first_login\` TINYINT NOT NULL DEFAULT 1,
        \`login_attempts\` INT NOT NULL DEFAULT 0,
        \`locked_until\` DATETIME NULL,
        \`last_login_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX \`uniq_users_username\` (\`username\`),
        UNIQUE INDEX \`uniq_users_phone\` (\`phone\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`aliyun_configs\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`config_type\` VARCHAR(32) NOT NULL,
        \`access_key\` TEXT NOT NULL,
        \`secret_key\` TEXT NOT NULL,
        \`sign_name\` VARCHAR(64) NULL,
        \`template_code\` VARCHAR(64) NULL,
        \`product_code\` VARCHAR(64) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uniq_config_type\` (\`config_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`monitor_tasks\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`user_id\` BIGINT NOT NULL,
        \`name\` VARCHAR(128) NOT NULL,
        \`keywords\` TEXT NOT NULL,
        \`exclude_keywords\` TEXT NULL,
        \`platforms\` JSON NOT NULL,
        \`match_mode\` ENUM('exact', 'fuzzy', 'both') NOT NULL DEFAULT 'both',
        \`sentiment_filter\` ENUM('all', 'positive', 'negative') NOT NULL DEFAULT 'all',
        \`min_read_threshold\` INT NOT NULL DEFAULT 0,
        \`min_like_threshold\` INT NOT NULL DEFAULT 0,
        \`frequency\` ENUM('5min', '15min', '30min', '60min') NOT NULL DEFAULT '15min',
        \`status\` ENUM('enabled', 'paused', 'error') NOT NULL DEFAULT 'enabled',
        \`last_run_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_monitor_tasks_user_id\` (\`user_id\`),
        INDEX \`idx_monitor_tasks_user_status\` (\`user_id\`, \`status\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`opinion_events\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`task_id\` BIGINT NOT NULL,
        \`platform\` VARCHAR(32) NOT NULL,
        \`title\` VARCHAR(512) NOT NULL,
        \`content\` TEXT NOT NULL,
        \`summary\` TEXT NOT NULL,
        \`author\` VARCHAR(128) NOT NULL,
        \`author_avatar\` VARCHAR(512) NULL,
        \`publish_time\` DATETIME NOT NULL,
        \`url\` VARCHAR(512) NOT NULL,
        \`read_count\` INT NOT NULL DEFAULT 0,
        \`like_count\` INT NOT NULL DEFAULT 0,
        \`comment_count\` INT NOT NULL DEFAULT 0,
        \`share_count\` INT NOT NULL DEFAULT 0,
        \`sentiment\` ENUM('positive', 'negative', 'neutral') NOT NULL DEFAULT 'neutral',
        \`matched_keywords\` JSON NOT NULL,
        \`raw_data\` JSON NOT NULL,
        \`status\` INT NOT NULL DEFAULT 0,
        \`matched_at\` DATETIME NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_task_time\` (\`task_id\`, \`matched_at\`),
        INDEX \`idx_publish_time\` (\`publish_time\`),
        INDEX \`idx_opinion_events_task_id\` (\`task_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`webhooks\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`user_id\` BIGINT NOT NULL,
        \`name\` VARCHAR(128) NOT NULL,
        \`url\` VARCHAR(512) NOT NULL,
        \`format\` ENUM('wecom', 'dingtalk', 'feishu', 'custom_json') NOT NULL DEFAULT 'custom_json',
        \`secret_key\` VARCHAR(128) NULL,
        \`ingest_token\` VARCHAR(128) NOT NULL,
        \`sms_alert_enabled\` TINYINT NOT NULL DEFAULT 0,
        \`push_on_match\` TINYINT NOT NULL DEFAULT 1,
        \`push_periodic\` TINYINT NOT NULL DEFAULT 0,
        \`periodic_freq\` ENUM('hourly', 'every_6h', 'daily') NULL,
        \`periodic_time\` VARCHAR(8) NULL,
        \`last_push_at\` DATETIME NULL,
        \`status\` ENUM('active', 'error', 'disabled') NOT NULL DEFAULT 'active',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_webhooks_user_id\` (\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`webhook_task_bindings\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`webhook_id\` BIGINT NOT NULL,
        \`task_id\` BIGINT NOT NULL,
        \`status\` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX \`uniq_webhook_task\` (\`webhook_id\`, \`task_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`webhook_push_logs\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`webhook_id\` BIGINT NOT NULL,
        \`event_id\` BIGINT NULL,
        \`http_status\` INT NOT NULL,
        \`response_body\` TEXT NULL,
        \`retry_count\` INT NOT NULL DEFAULT 0,
        \`result\` ENUM('success', 'failed', 'timeout') NOT NULL,
        \`duration_ms\` DECIMAL(10,2) NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_webhook_push_logs_webhook_id\` (\`webhook_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`sms_logs\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`phone\` VARCHAR(20) NOT NULL,
        \`scene\` ENUM('login', 'register', 'reset', 'notify', 'alert') NOT NULL,
        \`template_code\` VARCHAR(64) NOT NULL,
        \`status\` ENUM('sent', 'success', 'failed') NOT NULL,
        \`error_code\` VARCHAR(64) NULL,
        \`error_message\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_phone_time\` (\`phone\`, \`created_at\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`system_logs\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`operator_id\` BIGINT NULL,
        \`level\` ENUM('info', 'warn', 'error') NOT NULL DEFAULT 'info',
        \`module\` VARCHAR(64) NOT NULL,
        \`action\` VARCHAR(128) NOT NULL,
        \`detail\` TEXT NULL,
        \`ip_address\` VARCHAR(64) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_module_time\` (\`module\`, \`created_at\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`system_logs\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`sms_logs\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`webhook_push_logs\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`webhook_task_bindings\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`webhooks\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`opinion_events\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`monitor_tasks\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`aliyun_configs\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`users\`;`);
  }
}
