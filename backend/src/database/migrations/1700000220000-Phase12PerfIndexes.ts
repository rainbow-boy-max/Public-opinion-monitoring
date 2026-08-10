import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase12PerfIndexes1700000220000 implements MigrationInterface {
  name = 'Phase12PerfIndexes1700000220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 命中 dashboard / admin dashboard 按时间范围扫描的事件查询
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS \`idx_events_matched_at\` ON \`opinion_events\` (\`matched_at\`)`,
    );
    // 命中按 sentiment + 时间过滤的预警/负面统计
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS \`idx_events_sentiment_time\` ON \`opinion_events\` (\`sentiment\`, \`matched_at\`)`,
    );
    // 命中按 platform + 时间聚合的平台分布
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS \`idx_events_platform_time\` ON \`opinion_events\` (\`platform\`, \`matched_at\`)`,
    );
    // 命中按 publish_time 范围过滤的事件列表（已有 idx_publish_time 单列，这里补 task+publish 复合）
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS \`idx_events_task_publish\` ON \`opinion_events\` (\`task_id\`, \`publish_time\`)`,
    );
    // 命中按 status + 时间过滤的列表
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS \`idx_events_status_time\` ON \`opinion_events\` (\`status\`, \`matched_at\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS \`idx_events_status_time\` ON \`opinion_events\``);
    await queryRunner.query(`DROP INDEX IF EXISTS \`idx_events_task_publish\` ON \`opinion_events\``);
    await queryRunner.query(`DROP INDEX IF EXISTS \`idx_events_platform_time\` ON \`opinion_events\``);
    await queryRunner.query(`DROP INDEX IF EXISTS \`idx_events_sentiment_time\` ON \`opinion_events\``);
    await queryRunner.query(`DROP INDEX IF EXISTS \`idx_events_matched_at\` ON \`opinion_events\``);
  }
}
