import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFcmToUserEntity1766279016454 implements MigrationInterface {
    name = 'AddFcmToUserEntity1766279016454'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "images" DROP CONSTRAINT "FK_2d46215c11b52f2bb90200bb46d"`);
        await queryRunner.query(`ALTER TABLE "images" DROP COLUMN "comment_id"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "fcm_token" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "fcm_token"`);
        await queryRunner.query(`ALTER TABLE "images" ADD "comment_id" uuid`);
        await queryRunner.query(`ALTER TABLE "images" ADD CONSTRAINT "FK_2d46215c11b52f2bb90200bb46d" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
