import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditEvents1700000010000 implements MigrationInterface {
  name = 'CreateAuditEvents1700000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`audit_events\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`actor_id\` BIGINT NULL,
        \`actor_type\` ENUM('admin', 'user', 'system') NOT NULL DEFAULT 'admin',
        \`module\` VARCHAR(32) NOT NULL,
        \`action\` VARCHAR(32) NOT NULL,
        \`resource_type\` VARCHAR(32) NULL,
        \`resource_id\` BIGINT NULL,
        \`title\` VARCHAR(128) NOT NULL,
        \`content\` TEXT NULL,
        \`ip_address\` VARCHAR(64) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_audit_module_time\` (\`module\`, \`created_at\`),
        INDEX \`idx_audit_resource\` (\`resource_type\`, \`resource_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`audit_events\`;`);
  }
}
