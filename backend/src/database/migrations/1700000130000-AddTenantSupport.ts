import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantSupport1700000130000 implements MigrationInterface {
  name = 'AddTenantSupport1700000130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`tenants\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(128) NOT NULL,
        \`slug\` VARCHAR(64) NOT NULL,
        \`settings\` TEXT NULL,
        \`max_users\` INT NOT NULL DEFAULT 10,
        \`is_active\` TINYINT NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX \`idx_tenants_slug\` (\`slug\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    const hasTenantId = await queryRunner.hasColumn('users', 'tenant_id');
    if (!hasTenantId) {
      await queryRunner.query(`ALTER TABLE \`users\` ADD COLUMN \`tenant_id\` INT NULL AFTER \`role\``);
    }

    const monitorHasTenantId = await queryRunner.hasColumn('monitor_tasks', 'tenant_id');
    if (!monitorHasTenantId) {
      await queryRunner.query(`ALTER TABLE \`monitor_tasks\` ADD COLUMN \`tenant_id\` INT NULL AFTER \`id\``);
    }

    const webhookHasTenantId = await queryRunner.hasColumn('webhooks', 'tenant_id');
    if (!webhookHasTenantId) {
      await queryRunner.query(`ALTER TABLE \`webhooks\` ADD COLUMN \`tenant_id\` INT NULL AFTER \`id\``);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`webhooks\` DROP COLUMN \`tenant_id\``);
    await queryRunner.query(`ALTER TABLE \`monitor_tasks\` DROP COLUMN \`tenant_id\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`tenant_id\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`tenants\``);
  }
}
