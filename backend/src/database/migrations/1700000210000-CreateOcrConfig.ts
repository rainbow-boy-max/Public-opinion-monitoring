import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOcrConfig1700000210000 implements MigrationInterface {
  name = 'CreateOcrConfig1700000210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ocr_config (
        id INT PRIMARY KEY DEFAULT 1,
        primaryModelId INT NULL,
        backupModelIds JSON NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    await queryRunner.query(`
      INSERT IGNORE INTO ocr_config (id) VALUES (1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ocr_config`);
  }
}
