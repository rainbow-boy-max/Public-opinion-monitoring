import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase12FulltextPartitionArchive1700000230000 implements MigrationInterface {
  name = 'Phase12FulltextPartitionArchive1700000230000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 12.5 — FULLTEXT 全文索引（替代 ES 全文检索）
    await queryRunner.query(
      `ALTER TABLE \`opinion_events\` ADD FULLTEXT INDEX \`idx_events_fulltext\` (\`title\`, \`content\`, \`summary\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`short_videos\` ADD FULLTEXT INDEX \`idx_short_videos_fulltext\` (\`title\`, \`description\`, \`ocr_text\`, \`asr_text\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`work_orders\` ADD FULLTEXT INDEX \`idx_work_orders_fulltext\` (\`title\`, \`description\`)`,
    );

    // 12.6 — 归档表 + 归档时间戳字段
    // opinion_events 加 archived_at 字段
    await queryRunner.query(
      `ALTER TABLE \`opinion_events\` ADD COLUMN \`archived_at\` datetime NULL DEFAULT NULL AFTER \`created_at\``,
    );
    // 创建归档日志表
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`archive_logs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`entity_type\` varchar(64) NOT NULL,
        \`entity_id\` bigint NOT NULL,
        \`archived_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`reason\` varchar(255) DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_archive_logs_type_time\` (\`entity_type\`, \`archived_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );

    // 12.7 — 按月分区（opinion_events 替换为分区表）
    // 先创建按月的分区表，用 exchange 方式迁移
    // 当前月份分区 + 6 个未来分区 + 1 个历史分区
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const partitionDefs: string[] = [];
    // 历史分区（当前月之前所有数据）
    partitionDefs.push(
      `PARTITION p_history VALUES LESS THAN (${currentYear * 100 + currentMonth}) ENGINE = InnoDB`,
    );
    // 当前月 + 未来 5 个月
    for (let i = 0; i < 6; i++) {
      const m = currentMonth + i;
      let ym = currentYear * 100 + m;
      if (m > 12) {
        ym = (currentYear + 1) * 100 + (m - 12);
      }
      const label = `p_${ym}`;
      const nextYm = i < 5 ? (() => {
        const nm = currentMonth + i + 1;
        return nm > 12 ? (currentYear + 1) * 100 + (nm - 12) : currentYear * 100 + nm;
      })() : (currentYear + 100) * 100;
      partitionDefs.push(`PARTITION \`${label}\` VALUES LESS THAN (${nextYm}) ENGINE = InnoDB`);
    }
    // 未来分区（兜底）
    partitionDefs.push(
      `PARTITION \`p_future\` VALUES LESS THAN MAXVALUE ENGINE = InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`opinion_events\` PARTITION BY RANGE (YEAR(\`publish_time\`) * 100 + MONTH(\`publish_time\`)) (
        ${partitionDefs.join(',\n        ')}
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`opinion_events\` REMOVE PARTITIONING`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`archive_logs\``);
    await queryRunner.query(`ALTER TABLE \`opinion_events\` DROP COLUMN \`archived_at\``);
    await queryRunner.query(`DROP INDEX IF EXISTS \`idx_work_orders_fulltext\` ON \`work_orders\``);
    await queryRunner.query(`DROP INDEX IF EXISTS \`idx_short_videos_fulltext\` ON \`short_videos\``);
    await queryRunner.query(`DROP INDEX IF EXISTS \`idx_events_fulltext\` ON \`opinion_events\``);
  }
}