import { MigrationInterface, QueryRunner } from "typeorm";

export class FixNotifications1760712815640 implements MigrationInterface {
    name = 'FixNotifications1760712815640'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "subject_subscriptions" ("usersId" uuid NOT NULL, "subjectsId" uuid NOT NULL, CONSTRAINT "PK_5bb6915b4c9ff849a1cffcddb32" PRIMARY KEY ("usersId", "subjectsId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2244d97b49db2a4049d1d465f4" ON "subject_subscriptions" ("usersId") `);
        await queryRunner.query(`CREATE INDEX "IDX_056795a98e60581042352d523e" ON "subject_subscriptions" ("subjectsId") `);
        await queryRunner.query(`CREATE TABLE "facuty_subscriptions" ("usersId" uuid NOT NULL, "facultiesId" uuid NOT NULL, CONSTRAINT "PK_7109d91dc264c4fd012865e6365" PRIMARY KEY ("usersId", "facultiesId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_17f6c1416d9e48631f32423f35" ON "facuty_subscriptions" ("usersId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0ffaf216b25e0ce5fd44a086f9" ON "facuty_subscriptions" ("facultiesId") `);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('document', 'comment', 'profile')`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "type" "public"."notifications_type_enum" NOT NULL DEFAULT 'document'`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "target_id" character varying`);
        await queryRunner.query(`ALTER TABLE "subject_subscriptions" ADD CONSTRAINT "FK_2244d97b49db2a4049d1d465f49" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "subject_subscriptions" ADD CONSTRAINT "FK_056795a98e60581042352d523e2" FOREIGN KEY ("subjectsId") REFERENCES "subjects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "facuty_subscriptions" ADD CONSTRAINT "FK_17f6c1416d9e48631f32423f355" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "facuty_subscriptions" ADD CONSTRAINT "FK_0ffaf216b25e0ce5fd44a086f9b" FOREIGN KEY ("facultiesId") REFERENCES "faculties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "facuty_subscriptions" DROP CONSTRAINT "FK_0ffaf216b25e0ce5fd44a086f9b"`);
        await queryRunner.query(`ALTER TABLE "facuty_subscriptions" DROP CONSTRAINT "FK_17f6c1416d9e48631f32423f355"`);
        await queryRunner.query(`ALTER TABLE "subject_subscriptions" DROP CONSTRAINT "FK_056795a98e60581042352d523e2"`);
        await queryRunner.query(`ALTER TABLE "subject_subscriptions" DROP CONSTRAINT "FK_2244d97b49db2a4049d1d465f49"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "target_id"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ffaf216b25e0ce5fd44a086f9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_17f6c1416d9e48631f32423f35"`);
        await queryRunner.query(`DROP TABLE "facuty_subscriptions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_056795a98e60581042352d523e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2244d97b49db2a4049d1d465f4"`);
        await queryRunner.query(`DROP TABLE "subject_subscriptions"`);
    }

}
