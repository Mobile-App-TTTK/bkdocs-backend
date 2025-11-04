import { MigrationInterface, QueryRunner } from "typeorm";

export class FixNameForUserRelation1762243343321 implements MigrationInterface {
    name = 'FixNameForUserRelation1762243343321'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_a59d62cda8101214445e295cdc8"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_da722d93356ae3119d6be40d988"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a59d62cda8101214445e295cdc"`);
        await queryRunner.query(`ALTER TABLE "user_followers" RENAME COLUMN "user_id" TO "following_id"`);
        await queryRunner.query(`ALTER TABLE "user_followers" RENAME CONSTRAINT "PK_d7b47e785d7dbc74b2f22f30045" TO "PK_81bc622bd88e6ea821f9fa0ed97"`);
        await queryRunner.query(`CREATE INDEX "IDX_0092daece8ed943fec27d37c41" ON "user_followers" ("following_id") `);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_da722d93356ae3119d6be40d988" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_0092daece8ed943fec27d37c413" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_0092daece8ed943fec27d37c413"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_da722d93356ae3119d6be40d988"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0092daece8ed943fec27d37c41"`);
        await queryRunner.query(`ALTER TABLE "user_followers" RENAME CONSTRAINT "PK_81bc622bd88e6ea821f9fa0ed97" TO "PK_d7b47e785d7dbc74b2f22f30045"`);
        await queryRunner.query(`ALTER TABLE "user_followers" RENAME COLUMN "following_id" TO "user_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_a59d62cda8101214445e295cdc" ON "user_followers" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_da722d93356ae3119d6be40d988" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_a59d62cda8101214445e295cdc8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

}
