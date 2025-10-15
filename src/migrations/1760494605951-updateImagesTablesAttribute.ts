import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateImagesTablesAttribute1760494605951 implements MigrationInterface {
    name = 'UpdateImagesTablesAttribute1760494605951'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "images" DROP CONSTRAINT "FK_52ba34f1460881aa70376fe4090"`);
        await queryRunner.query(`ALTER TABLE "images" RENAME COLUMN "documentId" TO "document_id"`);
        await queryRunner.query(`ALTER TABLE "images" ADD CONSTRAINT "FK_6499d44a071fbd3a26a05159514" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "images" DROP CONSTRAINT "FK_6499d44a071fbd3a26a05159514"`);
        await queryRunner.query(`ALTER TABLE "images" RENAME COLUMN "document_id" TO "documentId"`);
        await queryRunner.query(`ALTER TABLE "images" ADD CONSTRAINT "FK_52ba34f1460881aa70376fe4090" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
