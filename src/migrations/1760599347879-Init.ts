import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1760599347879 implements MigrationInterface {
    name = 'Init1760599347879'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "password_resets" ADD "last_otp_sent_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD "token_hash" text`);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD "token_expires_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP COLUMN "otp_hash"`);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD "otp_hash" text`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP COLUMN "expires_at"`);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD "expires_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`UPDATE "password_resets" SET "expires_at" = COALESCE("created_at", now()) WHERE "expires_at" IS NULL`);
        await queryRunner.query(`ALTER TABLE "password_resets" ALTER COLUMN "expires_at" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_f7a4c3bc48f24df007936d217b" ON "password_resets" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_323290a9239ad3d397ad78018e" ON "password_resets" ("token_hash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_323290a9239ad3d397ad78018e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7a4c3bc48f24df007936d217b"`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP COLUMN "expires_at"`);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD "expires_at" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP COLUMN "otp_hash"`);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD "otp_hash" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP COLUMN "token_expires_at"`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP COLUMN "token_hash"`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP COLUMN "last_otp_sent_at"`);
    }

}
