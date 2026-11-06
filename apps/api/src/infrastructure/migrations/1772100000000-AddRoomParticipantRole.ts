import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomParticipantRole1772100000000 implements MigrationInterface {
  name = 'AddRoomParticipantRole1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // visitor = just entered the room; member/admin = explicitly invited by the owner/admins.
    await queryRunner.query(`ALTER TABLE "room_participant" ADD "role" character varying(10) NOT NULL DEFAULT 'visitor'`);
    await queryRunner.query(`UPDATE "room_participant" SET "role" = 'admin' WHERE "is_admin" = true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room_participant" DROP COLUMN "role"`);
  }
}
