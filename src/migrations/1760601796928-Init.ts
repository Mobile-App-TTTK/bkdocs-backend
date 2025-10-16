import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1760601796928 implements MigrationInterface {
    name = 'Init1760601796928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "password_resets" ADD "email" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD "purpose" character varying(16)`);
        await queryRunner.query(`UPDATE "password_resets" SET "purpose" = 'reset' WHERE "purpose" IS NULL`);
        await queryRunner.query(`ALTER TABLE "password_resets" ALTER COLUMN "purpose" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP CONSTRAINT "FK_f7a4c3bc48f24df007936d217be"`);
        await queryRunner.query(`ALTER TABLE "password_resets" ALTER COLUMN "user_id" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_7e57f540b334d522f9cf5b16ca" ON "password_resets" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_b8156d835bd6670eff937d30fe" ON "password_resets" ("purpose") `);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD CONSTRAINT "FK_f7a4c3bc48f24df007936d217be" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "password_resets" DROP CONSTRAINT "FK_f7a4c3bc48f24df007936d217be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b8156d835bd6670eff937d30fe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e57f540b334d522f9cf5b16ca"`);
        await queryRunner.query(`ALTER TABLE "password_resets" ALTER COLUMN "user_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD CONSTRAINT "FK_f7a4c3bc48f24df007936d217be" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP COLUMN "purpose"`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP COLUMN "email"`);
    }

}
