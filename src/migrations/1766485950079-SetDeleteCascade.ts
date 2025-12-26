import { MigrationInterface, QueryRunner } from "typeorm";

export class SetDeleteCascade1766485950079 implements MigrationInterface {
    name = 'SetDeleteCascade1766485950079'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "document_faculties" DROP CONSTRAINT "FK_d5734fb9396797b38ddbe29674b"`);
        await queryRunner.query(`ALTER TABLE "document_faculties" ADD CONSTRAINT "FK_d5734fb9396797b38ddbe29674b" FOREIGN KEY ("documentsId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "document_faculties" DROP CONSTRAINT "FK_d5734fb9396797b38ddbe29674b"`);
        await queryRunner.query(`ALTER TABLE "document_faculties" ADD CONSTRAINT "FK_d5734fb9396797b38ddbe29674b" FOREIGN KEY ("documentsId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
    }

}
