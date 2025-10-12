import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTableNameToSnakeCase1760235529771 implements MigrationInterface {
    name = 'UpdateTableNameToSnakeCase1760235529771'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" RENAME COLUMN "fileKey" TO "file_key"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" RENAME COLUMN "file_key" TO "fileKey"`);
    }

}
