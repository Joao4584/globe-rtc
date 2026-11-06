import { MigrationInterface, QueryRunner } from 'typeorm';
import { generateUniqueUsername } from '../../shared/username/username';

export class AddUserUsername1772000000000 implements MigrationInterface {
  name = 'AddUserUsername1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying(30)`);

    // Backfill existing users from the start of their email, oldest first so they get the clean name.
    const users: { id: number; email: string }[] = await queryRunner.query(`SELECT "id", "email" FROM "users" ORDER BY "id"`);
    const taken = new Set<string>();
    for (const user of users) {
      const username = await generateUniqueUsername(user.email, async (candidate) => taken.has(candidate));
      taken.add(username);
      await queryRunner.query(`UPDATE "users" SET "username" = $1 WHERE "id" = $2`, [username, user.id]);
    }

    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_username"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
  }
}
