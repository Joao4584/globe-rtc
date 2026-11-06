import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUserXp1771300000000 implements MigrationInterface {
  name = 'RemoveUserXp1771300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "xp"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "xp" integer NOT NULL DEFAULT 0`);
  }
}
