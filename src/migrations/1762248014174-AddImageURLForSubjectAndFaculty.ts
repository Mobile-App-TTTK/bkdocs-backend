import { MigrationInterface, QueryRunner } from "typeorm";

export class AddImageURLForSubjectAndFaculty1762248014174 implements MigrationInterface {
    name = 'AddImageURLForSubjectAndFaculty1762248014174'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "faculties" ADD "image_url" text`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD "image_url" text`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "image_key"`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD "image_key" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "image_key"`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD "image_key" character varying`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "image_url"`);
        await queryRunner.query(`ALTER TABLE "faculties" DROP COLUMN "image_url"`);
    }

}
