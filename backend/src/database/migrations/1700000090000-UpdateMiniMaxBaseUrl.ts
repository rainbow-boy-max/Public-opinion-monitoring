import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateMiniMaxBaseUrl1700000090000 implements MigrationInterface {
  name = 'UpdateMiniMaxBaseUrl1700000090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 一次性把所有 minimax / minimax_anthropic 预置模型的 baseUrl 切换到国内 minimaxi.com
    await queryRunner.query(
      `UPDATE \`llm_models\` SET \`base_url\` = 'https://api.minimaxi.com/v1' WHERE \`provider\` = 'minimax' AND \`base_url\` LIKE '%api.minimax.io%'`,
    );
    await queryRunner.query(
      `UPDATE \`llm_models\` SET \`base_url\` = 'https://api.minimaxi.com/anthropic' WHERE \`provider\` = 'minimax_anthropic' AND \`base_url\` LIKE '%api.minimax.io%'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`llm_models\` SET \`base_url\` = 'https://api.minimax.io/v1' WHERE \`provider\` = 'minimax' AND \`base_url\` LIKE '%api.minimaxi.com%'`,
    );
    await queryRunner.query(
      `UPDATE \`llm_models\` SET \`base_url\` = 'https://api.minimax.io/anthropic' WHERE \`provider\` = 'minimax_anthropic' AND \`base_url\` LIKE '%api.minimaxi.com%'`,
    );
  }
}
