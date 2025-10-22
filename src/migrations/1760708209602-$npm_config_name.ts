import { MigrationInterface, QueryRunner } from "typeorm";

export class  $npmConfigName1760708209602 implements MigrationInterface {
    name = ' $npmConfigName1760708209602'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."ux_faculties_name"`);
        await queryRunner.query(`DROP INDEX "public"."ux_subjects_name"`);
        await queryRunner.query(`DROP INDEX "public"."ux_users_email"`);
        await queryRunner.query(`CREATE TABLE "faculty_year_subjects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "year" smallint NOT NULL, "faculty_id" uuid, "subject_id" uuid, CONSTRAINT "UQ_11cf4a5c5c7151a05023961f0ff" UNIQUE ("faculty_id", "subject_id", "year"), CONSTRAINT "PK_c0a90691e05fdd73c0d5179c1d3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "year_of_study" smallint`);
        await queryRunner.query(`ALTER TABLE "faculty_year_subjects" ADD CONSTRAINT "FK_21ed3a2cb69db46666c42b60f33" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "faculty_year_subjects" ADD CONSTRAINT "FK_dfcb8d688a131a1f704c75818ec" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "faculty_year_subjects" DROP CONSTRAINT "FK_dfcb8d688a131a1f704c75818ec"`);
        await queryRunner.query(`ALTER TABLE "faculty_year_subjects" DROP CONSTRAINT "FK_21ed3a2cb69db46666c42b60f33"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "year_of_study"`);
        await queryRunner.query(`DROP TABLE "faculty_year_subjects"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "ux_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "ux_subjects_name" ON "subjects" ("name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "ux_faculties_name" ON "faculties" ("name") `);
    }

}
