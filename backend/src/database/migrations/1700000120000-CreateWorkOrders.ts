import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkOrders1700000120000 implements MigrationInterface {
  name = 'CreateWorkOrders1700000120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`work_orders\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`user_id\` BIGINT NOT NULL,
        \`assigned_to\` BIGINT NULL,
        \`type\` VARCHAR(32) NOT NULL DEFAULT 'manual',
        \`event_id\` BIGINT NULL,
        \`title\` VARCHAR(256) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`priority\` VARCHAR(16) NOT NULL DEFAULT 'medium',
        \`status\` VARCHAR(16) NOT NULL DEFAULT 'pending',
        \`analysis\` TEXT NULL,
        \`resolution\` TEXT NULL,
        \`resolution_type\` VARCHAR(32) NULL,
        \`due_at\` DATETIME NULL,
        \`resolved_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_work_orders_user_id\` (\`user_id\`),
        INDEX \`idx_work_orders_assigned_to\` (\`assigned_to\`),
        INDEX \`idx_work_orders_status\` (\`status\`),
        INDEX \`idx_work_orders_priority\` (\`priority\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`work_order_comments\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`order_id\` BIGINT NOT NULL,
        \`user_id\` BIGINT NOT NULL,
        \`content\` TEXT NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_work_order_comments_order_id\` (\`order_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`work_order_comments\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`work_orders\`;`);
  }
}
