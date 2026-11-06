import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoomDecoration1772200000000 implements MigrationInterface {
  name = 'CreateRoomDecoration1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "room_decoration" ("id" SERIAL NOT NULL, "public_id" character varying(26) NOT NULL, "room_id" integer NOT NULL, "type" character varying(32) NOT NULL, "x" integer NOT NULL, "y" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_room_decoration_public_id" UNIQUE ("public_id"), CONSTRAINT "PK_room_decoration_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_room_decoration_room" ON "room_decoration" ("room_id")`);
    await queryRunner.query(
      `ALTER TABLE "room_decoration" ADD CONSTRAINT "FK_room_decoration_room" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room_decoration" DROP CONSTRAINT "FK_room_decoration_room"`);
    await queryRunner.query(`DROP INDEX "IDX_room_decoration_room"`);
    await queryRunner.query(`DROP TABLE "room_decoration"`);
  }
}
