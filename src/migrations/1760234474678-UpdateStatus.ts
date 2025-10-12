import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateStatus1760234474678 implements MigrationInterface {
    name = 'UpdateStatus1760234474678'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."documents_status_enum" AS ENUM('active', 'inactive', 'pending')`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "status" "public"."documents_status_enum" NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`COMMENT ON COLUMN "documents"."status" IS 'Trạng thái của tài liệu'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "documents"."status" IS 'Trạng thái của tài liệu'`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."documents_status_enum"`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "status" character varying NOT NULL DEFAULT 'pending'`);
    }

}
