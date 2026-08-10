import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase12FixMissingTables1700000240000 implements MigrationInterface {
  name = 'Phase12FixMissingTables1700000240000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. alert_configs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`alert_configs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`user_id\` bigint NOT NULL,
        \`alert_level\` varchar(32) NOT NULL,
        \`enabled_channels\` json NOT NULL COMMENT '启用的通知渠道',
        \`quiet_hours\` json DEFAULT NULL COMMENT '免打扰时段',
        \`recipients\` json NOT NULL COMMENT '接收人列表',
        \`trigger_conditions\` json NOT NULL COMMENT '触发条件',
        \`is_enabled\` tinyint NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_alert_configs_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 2. alert_records
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`alert_records\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`event_id\` bigint NOT NULL,
        \`alert_level\` varchar(32) NOT NULL,
        \`alert_channel\` varchar(32) NOT NULL,
        \`recipient\` varchar(255) NOT NULL COMMENT '接收人',
        \`status\` varchar(32) NOT NULL DEFAULT 'pending',
        \`content\` text NOT NULL COMMENT '预警内容',
        \`sent_at\` datetime DEFAULT NULL,
        \`confirmed_at\` datetime DEFAULT NULL,
        \`confirmed_by\` bigint DEFAULT NULL,
        \`feedback\` text DEFAULT NULL COMMENT '处理反馈',
        \`error_message\` text DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_alert_records_event_id\` (\`event_id\`),
        KEY \`IDX_alert_records_alert_level\` (\`alert_level\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 3. attribution_analyses
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`attribution_analyses\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`event_id\` bigint NOT NULL,
        \`trigger_events\` json NOT NULL COMMENT '触发事件列表',
        \`key_nodes\` json NOT NULL COMMENT '关键传播节点',
        \`propagation_path\` json NOT NULL COMMENT '传播路径',
        \`analysis_content\` longtext NOT NULL COMMENT '归因分析内容',
        \`llm_generated\` tinyint NOT NULL DEFAULT 1 COMMENT '是否由LLM生成',
        \`analysis_duration_ms\` int DEFAULT NULL COMMENT '分析耗时（毫秒）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_attribution_analyses_event_id\` (\`event_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 4. trend_predictions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`trend_predictions\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`event_id\` bigint NOT NULL,
        \`prediction_horizon\` int NOT NULL COMMENT '预测时长（小时）',
        \`predicted_heat\` json NOT NULL COMMENT '预测热度数据点',
        \`risk_level\` varchar(32) NOT NULL,
        \`confidence_score\` decimal(5,2) NOT NULL COMMENT '置信度分数',
        \`anomaly_detected\` tinyint NOT NULL DEFAULT 0 COMMENT '是否检测到异常',
        \`algorithm_used\` varchar(64) NOT NULL DEFAULT 'moving_average' COMMENT '使用的算法',
        \`historical_data_points\` int NOT NULL COMMENT '使用的历史数据点数量',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_trend_predictions_event_id\` (\`event_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 5. report_generations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`report_generations\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`report_type\` varchar(32) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`start_date\` date NOT NULL,
        \`end_date\` date NOT NULL,
        \`status\` varchar(32) NOT NULL DEFAULT 'pending',
        \`content\` longtext DEFAULT NULL COMMENT '报告内容（Markdown）',
        \`export_format\` varchar(32) DEFAULT NULL,
        \`export_url\` text DEFAULT NULL,
        \`created_by\` bigint NOT NULL,
        \`error_message\` text DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`completed_at\` datetime DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_report_generations_report_type\` (\`report_type\`),
        KEY \`IDX_report_generations_status\` (\`status\`),
        KEY \`IDX_report_generations_created_by\` (\`created_by\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 6. aliyun_video_configs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`aliyun_video_configs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`access_key_id\` varchar(255) NOT NULL,
        \`access_key_secret\` varchar(255) NOT NULL,
        \`region_id\` varchar(64) NOT NULL DEFAULT 'cn-hangzhou',
        \`oss_bucket\` varchar(255) DEFAULT NULL,
        \`oss_endpoint\` varchar(255) DEFAULT NULL,
        \`vca_endpoint\` varchar(255) DEFAULT NULL COMMENT '视频OCR端点',
        \`asr_app_key\` varchar(255) DEFAULT NULL COMMENT '语音识别AppKey',
        \`asr_endpoint\` varchar(255) DEFAULT NULL,
        \`is_enabled\` tinyint NOT NULL DEFAULT 0,
        \`remark\` text DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 7. short_video_configs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`short_video_configs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`platform\` varchar(32) NOT NULL,
        \`app_key\` varchar(255) DEFAULT NULL,
        \`app_secret\` varchar(255) DEFAULT NULL,
        \`api_base_url\` varchar(255) DEFAULT NULL,
        \`is_enabled\` tinyint NOT NULL DEFAULT 0,
        \`extra_config\` text DEFAULT NULL COMMENT '平台特有配置 JSON',
        \`remark\` text DEFAULT NULL COMMENT '备注',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_short_video_configs_platform\` (\`platform\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 8. video_transcripts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`video_transcripts\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`video_id\` bigint NOT NULL,
        \`start_time\` float NOT NULL COMMENT '语音片段开始时间（秒）',
        \`end_time\` float NOT NULL COMMENT '语音片段结束时间（秒）',
        \`text\` text NOT NULL COMMENT 'ASR 识别文本',
        \`confidence\` float DEFAULT NULL COMMENT 'ASR 识别置信度',
        \`speaker\` varchar(64) DEFAULT NULL COMMENT '说话人标识',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_video_transcripts_video_id\` (\`video_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 9. video_frames
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`video_frames\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`video_id\` bigint NOT NULL,
        \`frame_index\` int NOT NULL COMMENT '帧序号（第几帧）',
        \`timestamp\` float NOT NULL COMMENT '视频时间戳（秒）',
        \`frame_url\` text NOT NULL COMMENT '抽帧图片 URL',
        \`ocr_text\` text DEFAULT NULL,
        \`ocr_confidence\` float DEFAULT NULL COMMENT 'OCR 识别置信度',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_video_frames_video_id\` (\`video_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 10. gov_monitor_sites
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`gov_monitor_sites\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`site_name\` varchar(255) NOT NULL,
        \`url\` varchar(512) NOT NULL,
        \`site_type\` varchar(32) NOT NULL DEFAULT 'self',
        \`css_selector\` varchar(500) DEFAULT NULL,
        \`check_frequency\` int NOT NULL DEFAULT 60,
        \`status\` varchar(32) NOT NULL DEFAULT 'active',
        \`last_checked_at\` datetime DEFAULT NULL,
        \`last_content_hash\` varchar(64) DEFAULT NULL,
        \`created_by\` bigint NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_gov_monitor_sites_site_name\` (\`site_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 11. gov_monitor_changes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`gov_monitor_changes\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`site_id\` bigint NOT NULL,
        \`change_type\` varchar(32) NOT NULL,
        \`title\` varchar(500) NOT NULL,
        \`link_url\` varchar(512) DEFAULT NULL,
        \`snippet\` text DEFAULT NULL,
        \`content_hash\` varchar(64) NOT NULL,
        \`detected_at\` datetime NOT NULL,
        \`is_read\` tinyint NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_gov_monitor_changes_site_id\` (\`site_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 12. gov_briefings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`gov_briefings\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`briefing_type\` varchar(32) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`start_date\` date NOT NULL,
        \`end_date\` date NOT NULL,
        \`content\` longtext NOT NULL,
        \`status\` varchar(32) NOT NULL DEFAULT 'draft',
        \`export_format\` varchar(32) DEFAULT NULL,
        \`export_url\` varchar(500) DEFAULT NULL,
        \`submitted_at\` datetime DEFAULT NULL,
        \`submitted_to\` varchar(255) DEFAULT NULL,
        \`created_by\` bigint NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_gov_briefings_briefing_type\` (\`briefing_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 13. leader_instructions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`leader_instructions\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`event_id\` bigint NOT NULL,
        \`leader_name\` varchar(100) NOT NULL,
        \`instruction\` text NOT NULL,
        \`status\` varchar(32) NOT NULL DEFAULT 'pending',
        \`handler_name\` varchar(100) DEFAULT NULL,
        \`feedback\` text DEFAULT NULL,
        \`deadline\` date DEFAULT NULL,
        \`completed_at\` datetime DEFAULT NULL,
        \`created_by\` bigint NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_leader_instructions_event_id\` (\`event_id\`),
        KEY \`IDX_leader_instructions_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`leader_instructions\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`gov_briefings\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`gov_monitor_changes\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`gov_monitor_sites\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`video_frames\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`video_transcripts\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`short_video_configs\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`aliyun_video_configs\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`report_generations\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`trend_predictions\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`attribution_analyses\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`alert_records\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`alert_configs\``);
  }
}