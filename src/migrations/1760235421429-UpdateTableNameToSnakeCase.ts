import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTableNameToSnakeCase1760235421429 implements MigrationInterface {
    name = 'UpdateTableNameToSnakeCase1760235421429'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_4d0b0e3a4c4af854d225154ba40"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_bf2b7eceb0a1df16f942888630e"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_befd700a02312da4cc725ccaace"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_88a8881bddb8f5bd5127aa164c1"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_bff6f075d96fe9259bf2609c8cd"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "UQ_59d77e3c352aa1c986317206401"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP COLUMN "documentId"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "uploaderId"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "subjectId"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "facultyId"`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "user_id" uuid`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD "user_id" uuid`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD "document_id" uuid`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "uploader_id" uuid`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "subject_id" uuid`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "faculty_id" uuid`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "UQ_db6c10b554db6ca29d4b6b8a461" UNIQUE ("user_id", "document_id")`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_f49ef8d0914a14decddbb170f2f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_81dc90177535f4ea2e587ae672e" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_27c5610c1cd91c780af8ea85e38" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_a573af1eae04180e1f6be40e538" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_5feeeb8b089765ac5371b35e272" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_5feeeb8b089765ac5371b35e272"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_a573af1eae04180e1f6be40e538"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_27c5610c1cd91c780af8ea85e38"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_81dc90177535f4ea2e587ae672e"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_f49ef8d0914a14decddbb170f2f"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "UQ_db6c10b554db6ca29d4b6b8a461"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "faculty_id"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "subject_id"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "uploader_id"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP COLUMN "document_id"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP COLUMN "user_id"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "user_id"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "facultyId" uuid`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "subjectId" uuid`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "uploaderId" uuid`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD "documentId" uuid`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD "userId" uuid`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "userId" uuid`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "UQ_59d77e3c352aa1c986317206401" UNIQUE ("userId", "documentId")`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_bff6f075d96fe9259bf2609c8cd" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_88a8881bddb8f5bd5127aa164c1" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_befd700a02312da4cc725ccaace" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_bf2b7eceb0a1df16f942888630e" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_4d0b0e3a4c4af854d225154ba40" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
