import { MigrationInterface, QueryRunner } from "typeorm";

export class AdduserfalcutyAndImage1760507627210 implements MigrationInterface {
    name = 'AdduserfalcutyAndImage1760507627210'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "image_key" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "faculty_id" uuid`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_a0842240f363f156f8ee9377fad" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_a0842240f363f156f8ee9377fad"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "faculty_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "image_key"`);
    }

}
