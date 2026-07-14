import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLlmModelSortOrder1700000070000 implements MigrationInterface {
  name = 'AddLlmModelSortOrder1700000070000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`llm_models\` ADD COLUMN \`sort_order\` INT NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`llm_models\` ADD INDEX \`idx_llm_models_sort\` (\`sort_order\`, \`id\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`llm_models\` DROP INDEX \`idx_llm_models_sort\``);
    await queryRunner.query(`ALTER TABLE \`llm_models\` DROP COLUMN \`sort_order\``);
  }
}
