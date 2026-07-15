import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterUserRoleVarchar1700000110000 implements MigrationInterface {
  name = 'AlterUserRoleVarchar1700000110000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // MySQL: change ENUM to VARCHAR
    // SQLite: no-op (SQLite doesn't support ENUM)
    const driver = queryRunner.connection.driver;
    if (driver.options.type === 'mysql') {
      await queryRunner.query(`ALTER TABLE users MODIFY COLUMN \`role\` VARCHAR(32) NOT NULL DEFAULT 'user'`);
      await queryRunner.query(`ALTER TABLE users MODIFY COLUMN \`auth_status\` VARCHAR(32) NOT NULL DEFAULT 'unverified'`);
    }
    // For SQLite, these are already handled by TypeORM schema sync
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver;
    if (driver.options.type === 'mysql') {
      await queryRunner.query(`ALTER TABLE users MODIFY COLUMN \`role\` ENUM('admin', 'user') NOT NULL DEFAULT 'user'`);
      await queryRunner.query(`ALTER TABLE users MODIFY COLUMN \`auth_status\` ENUM('unverified', 'verified', 'banned') NOT NULL DEFAULT 'unverified'`);
    }
  }
}
