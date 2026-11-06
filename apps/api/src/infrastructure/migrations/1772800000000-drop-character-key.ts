import { MigrationInterface, QueryRunner } from 'typeorm';

// The fixed default characters are gone: players now use the character they build (user_skin), so the chosen default is not stored anymore.
export class DropCharacterKey1772800000000 implements MigrationInterface {
  name = 'DropCharacterKey1772800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "character_key"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "character_key" character varying(15)`);
  }
}
