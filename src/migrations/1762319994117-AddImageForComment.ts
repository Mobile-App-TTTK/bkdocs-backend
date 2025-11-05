import { MigrationInterface, QueryRunner } from "typeorm";

export class AddImageForComment1762319994117 implements MigrationInterface {
    name = 'AddImageForComment1762319994117'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "images" ADD "comment_id" uuid`);
        await queryRunner.query(`ALTER TABLE "comments" ADD "image_key" text`);
        await queryRunner.query(`ALTER TABLE "comments" ADD "image_url" text`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "UQ_b1922cd33bb6388ab37117eaab0" UNIQUE ("user_id", "document_id")`);
        await queryRunner.query(`ALTER TABLE "images" ADD CONSTRAINT "FK_2d46215c11b52f2bb90200bb46d" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "images" DROP CONSTRAINT "FK_2d46215c11b52f2bb90200bb46d"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "UQ_b1922cd33bb6388ab37117eaab0"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "image_url"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "image_key"`);
        await queryRunner.query(`ALTER TABLE "images" DROP COLUMN "comment_id"`);
    }

}
