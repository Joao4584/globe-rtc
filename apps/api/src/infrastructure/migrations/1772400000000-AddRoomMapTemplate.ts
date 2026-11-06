import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomMapTemplate1772400000000 implements MigrationInterface {
  name = 'AddRoomMapTemplate1772400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room" ADD "map_template_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "room" ADD CONSTRAINT "FK_room_map_template" FOREIGN KEY ("map_template_id") REFERENCES "map_template"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room" DROP CONSTRAINT "FK_room_map_template"`);
    await queryRunner.query(`ALTER TABLE "room" DROP COLUMN "map_template_id"`);
  }
}
