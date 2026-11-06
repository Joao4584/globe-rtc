import { MigrationInterface, QueryRunner } from 'typeorm';

// The character moves from a jsonb column on users to its own table, linked to the spritesheet file saved in uploads/character.
export class AddUserSkinTable1772700000000 implements MigrationInterface {
  name = 'AddUserSkinTable1772700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "skin"`);
    await queryRunner.query(
      `CREATE TABLE "user_skin" (
        "id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "selection" jsonb NOT NULL,
        "file_name" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_skin_user_id" UNIQUE ("user_id"),
        CONSTRAINT "PK_user_skin_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_skin_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_skin"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "skin" jsonb`);
  }
}
