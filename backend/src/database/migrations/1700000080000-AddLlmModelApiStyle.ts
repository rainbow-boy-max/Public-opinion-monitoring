import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLlmModelApiStyle1700000080000 implements MigrationInterface {
  name = 'AddLlmModelApiStyle1700000080000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`llm_models\` ADD COLUMN \`api_style\` ENUM('openai','anthropic') NOT NULL DEFAULT 'openai'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`llm_models\` DROP COLUMN \`api_style\``);
  }
}
