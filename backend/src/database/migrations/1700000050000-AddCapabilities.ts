import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCapabilities1700000050000 implements MigrationInterface {
  name = 'AddCapabilities1700000050000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`llm_models\` ADD COLUMN \`capabilities\` JSON NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`agents\` ADD COLUMN \`capabilities\` JSON NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`agents\` DROP COLUMN \`capabilities\``);
    await queryRunner.query(`ALTER TABLE \`llm_models\` DROP COLUMN \`capabilities\``);
  }
}