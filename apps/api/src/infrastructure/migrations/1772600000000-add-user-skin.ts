import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSkin1772600000000 implements MigrationInterface {
  name = 'AddUserSkin1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "skin" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "skin"`);
  }
}
