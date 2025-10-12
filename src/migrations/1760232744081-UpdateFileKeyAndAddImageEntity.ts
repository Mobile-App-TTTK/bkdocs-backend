import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateFileKeyAndAddImageEntity1760232744081 implements MigrationInterface {
    name = 'UpdateFileKeyAndAddImageEntity1760232744081'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "images" ("fileKey" character varying NOT NULL, "documentId" uuid, CONSTRAINT "PK_c49e5ffe26fb6c06664bd001ae7" PRIMARY KEY ("fileKey"))`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "fileUrl"`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "fileKey" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "thumbnailUrl" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "images" ADD CONSTRAINT "FK_52ba34f1460881aa70376fe4090" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "images" DROP CONSTRAINT "FK_52ba34f1460881aa70376fe4090"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "thumbnailUrl"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "fileKey"`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "fileUrl" character varying NOT NULL`);
        await queryRunner.query(`DROP TABLE "images"`);
    }

}
