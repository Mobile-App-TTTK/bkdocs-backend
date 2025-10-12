import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTableNameToSnakeCase1760235021206 implements MigrationInterface {
    name = 'UpdateTableNameToSnakeCase1760235021206'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" RENAME COLUMN "isRead" TO "is_read"`);
        await queryRunner.query(`ALTER TABLE "ratings" RENAME COLUMN "createdAt" TO "created_at"`);
        await queryRunner.query(`ALTER TABLE "images" RENAME COLUMN "fileKey" TO "file_key"`);
        await queryRunner.query(`ALTER TABLE "images" RENAME CONSTRAINT "PK_c49e5ffe26fb6c06664bd001ae7" TO "PK_932c7c986f598d25111c5bc6926"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "downloadCount"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "uploadDate"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "thumbnailKey"`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "thumbnail_key" character varying`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "download_count" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "upload_date" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "upload_date"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "download_count"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "thumbnail_key"`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "thumbnailKey" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "uploadDate" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "downloadCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "images" RENAME CONSTRAINT "PK_932c7c986f598d25111c5bc6926" TO "PK_c49e5ffe26fb6c06664bd001ae7"`);
        await queryRunner.query(`ALTER TABLE "images" RENAME COLUMN "file_key" TO "fileKey"`);
        await queryRunner.query(`ALTER TABLE "ratings" RENAME COLUMN "created_at" TO "createdAt"`);
        await queryRunner.query(`ALTER TABLE "notifications" RENAME COLUMN "is_read" TO "isRead"`);
    }

}
