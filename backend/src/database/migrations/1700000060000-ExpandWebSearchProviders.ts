import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandWebSearchProviders1700000060000 implements MigrationInterface {
  name = 'ExpandWebSearchProviders1700000060000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE web_search_configs MODIFY COLUMN provider VARCHAR(32) NOT NULL DEFAULT 'duckduckgo'`);
    await queryRunner.query(`ALTER TABLE llm_models ADD COLUMN tool_supported JSON NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE llm_models DROP COLUMN tool_supported`);
  }
}