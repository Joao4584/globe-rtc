import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMapTemplate1772300000000 implements MigrationInterface {
  name = 'CreateMapTemplate1772300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "map_template" ("id" SERIAL NOT NULL, "public_id" character varying(26) NOT NULL, "user_id" integer NOT NULL, "name" character varying(80) NOT NULL, "data" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_map_template_public_id" UNIQUE ("public_id"), CONSTRAINT "PK_map_template_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_map_template_user" ON "map_template" ("user_id")`);
    await queryRunner.query(
      `ALTER TABLE "map_template" ADD CONSTRAINT "FK_map_template_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "map_template" DROP CONSTRAINT "FK_map_template_user"`);
    await queryRunner.query(`DROP INDEX "IDX_map_template_user"`);
    await queryRunner.query(`DROP TABLE "map_template"`);
  }
}
