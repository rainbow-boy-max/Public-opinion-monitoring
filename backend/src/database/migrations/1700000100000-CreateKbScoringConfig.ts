import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKbScoringConfig1700000100000 implements MigrationInterface {
  name = 'CreateKbScoringConfig1700000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`kb_scoring_configs\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`primary_model_id\` BIGINT NOT NULL DEFAULT 0,
        \`fallback_model_ids\` JSON NULL,
        \`enable_web_search\` TINYINT NOT NULL DEFAULT 0,
        \`enable_vision\` TINYINT NOT NULL DEFAULT 0,
        \`updated_by\` BIGINT NULL,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );
    await queryRunner.query(
      `INSERT INTO \`kb_scoring_configs\` (id, primary_model_id, enable_web_search, enable_vision) VALUES (1, 0, 0, 0);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`kb_scoring_configs\`;`);
  }
}
