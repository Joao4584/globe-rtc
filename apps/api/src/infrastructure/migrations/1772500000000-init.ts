import { MigrationInterface, QueryRunner } from 'typeorm';

// Single clean schema: replaces the old chain of 15 migrations (init, friends, favorites, xp, decoration...).
// Existing databases created with the old chain must be recreated (drop the schema, then run the migrations again).
export class Init1772500000000 implements MigrationInterface {
  name = 'Init1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."users_language_enum" AS ENUM('en_us', 'pt_br')`);

    await queryRunner.query(
      `CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "public_id" character varying(26) NOT NULL,
        "last_login_iat" bigint,
        "name" character varying NOT NULL,
        "username" character varying(30) NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying,
        "github_id" character varying,
        "google_id" character varying,
        "avatar_url" character varying,
        "github_link" character varying,
        "bio" character varying,
        "language" "public"."users_language_enum" NOT NULL DEFAULT 'pt_br',
        "last_online" TIMESTAMP,
        "character_key" character varying(15),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_public_id" UNIQUE ("public_id"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_github_id" UNIQUE ("github_id"),
        CONSTRAINT "UQ_users_google_id" UNIQUE ("google_id")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "map_template" (
        "id" SERIAL NOT NULL,
        "public_id" character varying(26) NOT NULL,
        "user_id" integer NOT NULL,
        "name" character varying(80) NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_map_template_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_map_template_public_id" UNIQUE ("public_id"),
        CONSTRAINT "FK_a1d4fbbb355fda1e660a84aa975" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_map_template_user" ON "map_template" ("user_id")`);

    await queryRunner.query(
      `CREATE TABLE "room" (
        "id" SERIAL NOT NULL,
        "public_id" character varying(26) NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "is_public" boolean NOT NULL DEFAULT true,
        "password" character varying,
        "map_template_id" integer,
        "owner_id" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_room_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_room_public_id" UNIQUE ("public_id"),
        CONSTRAINT "FK_6dfeeefd28618a1351a1a1a9171" FOREIGN KEY ("owner_id") REFERENCES "users"("id"),
        CONSTRAINT "FK_room_map_template" FOREIGN KEY ("map_template_id") REFERENCES "map_template"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "room_participant" (
        "id" SERIAL NOT NULL,
        "public_id" character varying(26) NOT NULL,
        "room_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "is_admin" boolean NOT NULL DEFAULT false,
        "role" character varying(10) NOT NULL DEFAULT 'visitor',
        "joined_at" TIMESTAMP NOT NULL,
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_room_participant_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_room_participant_public_id" UNIQUE ("public_id"),
        CONSTRAINT "FK_e2fdb65131fd5bf286f19c0f333" FOREIGN KEY ("room_id") REFERENCES "room"("id"),
        CONSTRAINT "FK_97ace299842b63901959fab1adc" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "room_favorite" (
        "id" SERIAL NOT NULL,
        "public_id" character varying(26) NOT NULL,
        "user_id" integer NOT NULL,
        "room_id" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_favorite_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_room_favorite_public_id" UNIQUE ("public_id"),
        CONSTRAINT "UQ_room_favorite_user_room" UNIQUE ("user_id", "room_id"),
        CONSTRAINT "FK_b1894b1ad916f4eb1a19d5b019b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_e7b4e0bc5e614b8a593f3e0a9a6" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "friends" (
        "id" SERIAL NOT NULL,
        "public_id" character varying(26) NOT NULL,
        "user_id" integer NOT NULL,
        "friend_id" integer NOT NULL,
        "accepted_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_friends_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_friends_public_id" UNIQUE ("public_id"),
        CONSTRAINT "FK_f2534e418d51fa6e5e8cdd4b480" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_c9d447f72456a67d17ec30c5d00" FOREIGN KEY ("friend_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "upload_file" (
        "id" SERIAL NOT NULL,
        "public_id" character varying(26) NOT NULL,
        "url" character varying NOT NULL,
        "type" character varying NOT NULL,
        "room_id" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_upload_file_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_upload_file_public_id" UNIQUE ("public_id"),
        CONSTRAINT "FK_30de94989284b13d2387bc8c979" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "support_request" (
        "id" SERIAL NOT NULL,
        "public_id" character varying(26) NOT NULL,
        "user_id" integer NOT NULL,
        "subject" character varying(120) NOT NULL,
        "message" text NOT NULL,
        "rating" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_support_request_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_support_request_public_id" UNIQUE ("public_id"),
        CONSTRAINT "CHK_support_request_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
        CONSTRAINT "FK_cbc2e61fe04e17bc3c31595740d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "support_request"`);
    await queryRunner.query(`DROP TABLE "upload_file"`);
    await queryRunner.query(`DROP TABLE "friends"`);
    await queryRunner.query(`DROP TABLE "room_favorite"`);
    await queryRunner.query(`DROP TABLE "room_participant"`);
    await queryRunner.query(`DROP TABLE "room"`);
    await queryRunner.query(`DROP INDEX "IDX_map_template_user"`);
    await queryRunner.query(`DROP TABLE "map_template"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_language_enum"`);
  }
}
