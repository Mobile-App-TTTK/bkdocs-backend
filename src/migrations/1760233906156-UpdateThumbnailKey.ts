import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateThumbnailKey1760233906156 implements MigrationInterface {
    name = 'UpdateThumbnailKey1760233906156'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" RENAME COLUMN "thumbnailUrl" TO "thumbnailKey"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" RENAME COLUMN "thumbnailKey" TO "thumbnailUrl"`);
    }

}
