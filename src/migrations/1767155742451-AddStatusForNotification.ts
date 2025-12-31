import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusForNotification1767155742451 implements MigrationInterface {
    name = 'AddStatusForNotification1767155742451'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('document', 'document_approved', 'comment', 'profile')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'document'`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('document', 'comment', 'profile')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'document'`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`);
    }

}
