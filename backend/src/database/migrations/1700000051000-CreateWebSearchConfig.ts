import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebSearchConfig1700000051000 implements MigrationInterface {
  name = 'CreateWebSearchConfig1700000051000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`web_search_configs\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`provider\` ENUM('duckduckgo','brave') NOT NULL DEFAULT 'duckduckgo',
        \`api_key_enc\` TEXT NULL,
        \`max_results\` INT NOT NULL DEFAULT 5,
        \`is_enabled\` TINYINT NOT NULL DEFAULT 0,
        \`updated_by\` BIGINT NULL,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );
    await queryRunner.query(
      `INSERT INTO \`web_search_configs\` (id, provider, max_results, is_enabled) VALUES (1, 'duckduckgo', 5, 0);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`web_search_configs\`;`);
  }
}