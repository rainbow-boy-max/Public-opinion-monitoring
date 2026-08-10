import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase12CaptchaConfig1700000250000 implements MigrationInterface {
  name = 'Phase12CaptchaConfig1700000250000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`captcha_configs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`is_enabled\` tinyint NOT NULL DEFAULT 0,
        \`region\` varchar(32) NOT NULL DEFAULT 'cn',
        \`prefix\` varchar(128) DEFAULT NULL,
        \`scene_id\` varchar(128) DEFAULT NULL,
        \`access_key_id\` varchar(256) DEFAULT NULL,
        \`access_key_secret\` varchar(512) DEFAULT NULL,
        \`endpoint\` varchar(256) NOT NULL DEFAULT 'captcha.cn-shanghai.aliyuncs.com',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`captcha_configs\``);
  }
}