import { MigrationInterface, QueryRunner } from "typeorm";

export class Addbanstatus1766737133824 implements MigrationInterface {
    name = 'Addbanstatus1766737133824'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_ban_status_enum" AS ENUM('NONE', 'BANNED')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "ban_status" "public"."users_ban_status_enum" NOT NULL DEFAULT 'NONE'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "ban_status"`);
        await queryRunner.query(`DROP TYPE "public"."users_ban_status_enum"`);
    }

}
