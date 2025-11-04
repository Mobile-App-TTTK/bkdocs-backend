import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDBForNewDesign1762103537855 implements MigrationInterface {
    name = 'FixDBForNewDesign1762103537855'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_5feeeb8b089765ac5371b35e272"`);
        await queryRunner.query(`CREATE TABLE "document_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, CONSTRAINT "PK_d467d7eeb7c8ce216e90e8494aa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "document_faculties" ("documentsId" uuid NOT NULL, "facultiesId" uuid NOT NULL, CONSTRAINT "PK_f32e355a82b38efdf77af8e04a8" PRIMARY KEY ("documentsId", "facultiesId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d5734fb9396797b38ddbe29674" ON "document_faculties" ("documentsId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a86003585b373dbfbd1e93a14" ON "document_faculties" ("facultiesId") `);
        await queryRunner.query(`CREATE TABLE "user_followers" ("usersId_1" uuid NOT NULL, "usersId_2" uuid NOT NULL, CONSTRAINT "PK_cbd7f8b8e397b3867f245daf264" PRIMARY KEY ("usersId_1", "usersId_2"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e2c80e08dfc872dae9aa64efbb" ON "user_followers" ("usersId_1") `);
        await queryRunner.query(`CREATE INDEX "IDX_68e594a8874a92aa113ae7525d" ON "user_followers" ("usersId_2") `);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "faculty_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "year_of_study"`);
        await queryRunner.query(`ALTER TABLE "faculties" ADD "image_key" character varying`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD "image_key" character varying`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "file_type" character varying`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "document_type_id" uuid`);
        await queryRunner.query(`ALTER TABLE "users" ADD "intake_year" integer`);
        await queryRunner.query(`ALTER TABLE "users" ADD "is_verified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_5e174bbf5fb523874f836c425e9" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_faculties" ADD CONSTRAINT "FK_d5734fb9396797b38ddbe29674b" FOREIGN KEY ("documentsId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document_faculties" ADD CONSTRAINT "FK_6a86003585b373dbfbd1e93a14c" FOREIGN KEY ("facultiesId") REFERENCES "faculties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_e2c80e08dfc872dae9aa64efbbf" FOREIGN KEY ("usersId_1") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_68e594a8874a92aa113ae7525df" FOREIGN KEY ("usersId_2") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_68e594a8874a92aa113ae7525df"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_e2c80e08dfc872dae9aa64efbbf"`);
        await queryRunner.query(`ALTER TABLE "document_faculties" DROP CONSTRAINT "FK_6a86003585b373dbfbd1e93a14c"`);
        await queryRunner.query(`ALTER TABLE "document_faculties" DROP CONSTRAINT "FK_d5734fb9396797b38ddbe29674b"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_5e174bbf5fb523874f836c425e9"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_verified"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "intake_year"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "document_type_id"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "file_type"`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "image_key"`);
        await queryRunner.query(`ALTER TABLE "faculties" DROP COLUMN "image_key"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "year_of_study" smallint`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "faculty_id" uuid`);
        await queryRunner.query(`DROP INDEX "public"."IDX_68e594a8874a92aa113ae7525d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e2c80e08dfc872dae9aa64efbb"`);
        await queryRunner.query(`DROP TABLE "user_followers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6a86003585b373dbfbd1e93a14"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d5734fb9396797b38ddbe29674"`);
        await queryRunner.query(`DROP TABLE "document_faculties"`);
        await queryRunner.query(`DROP TABLE "document_types"`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_5feeeb8b089765ac5371b35e272" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
