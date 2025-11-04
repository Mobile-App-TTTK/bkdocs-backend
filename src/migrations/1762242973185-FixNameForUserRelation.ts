import { MigrationInterface, QueryRunner } from "typeorm";

export class FixNameForUserRelation1762242973185 implements MigrationInterface {
    name = 'FixNameForUserRelation1762242973185'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_e2c80e08dfc872dae9aa64efbbf"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_68e594a8874a92aa113ae7525df"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e2c80e08dfc872dae9aa64efbb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_68e594a8874a92aa113ae7525d"`);
        await queryRunner.query(`CREATE TABLE "faculty_subscriptions" ("usersId" uuid NOT NULL, "facultiesId" uuid NOT NULL, CONSTRAINT "PK_24bfb8c500a7447d8f6bc21a04d" PRIMARY KEY ("usersId", "facultiesId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d6b7c3ebae0d38d5a69aa4c2f0" ON "faculty_subscriptions" ("usersId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9caa26a2d5be8c75341e2b73e3" ON "faculty_subscriptions" ("facultiesId") `);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "PK_cbd7f8b8e397b3867f245daf264"`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "PK_68e594a8874a92aa113ae7525df" PRIMARY KEY ("usersId_2")`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP COLUMN "usersId_1"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "PK_68e594a8874a92aa113ae7525df"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP COLUMN "usersId_2"`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD "user_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "PK_a59d62cda8101214445e295cdc8" PRIMARY KEY ("user_id")`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD "follower_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "PK_a59d62cda8101214445e295cdc8"`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "PK_d7b47e785d7dbc74b2f22f30045" PRIMARY KEY ("user_id", "follower_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_a59d62cda8101214445e295cdc" ON "user_followers" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_da722d93356ae3119d6be40d98" ON "user_followers" ("follower_id") `);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_a59d62cda8101214445e295cdc8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_da722d93356ae3119d6be40d988" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "faculty_subscriptions" ADD CONSTRAINT "FK_d6b7c3ebae0d38d5a69aa4c2f04" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "faculty_subscriptions" ADD CONSTRAINT "FK_9caa26a2d5be8c75341e2b73e3a" FOREIGN KEY ("facultiesId") REFERENCES "faculties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "faculty_subscriptions" DROP CONSTRAINT "FK_9caa26a2d5be8c75341e2b73e3a"`);
        await queryRunner.query(`ALTER TABLE "faculty_subscriptions" DROP CONSTRAINT "FK_d6b7c3ebae0d38d5a69aa4c2f04"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_da722d93356ae3119d6be40d988"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_a59d62cda8101214445e295cdc8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da722d93356ae3119d6be40d98"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a59d62cda8101214445e295cdc"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "PK_d7b47e785d7dbc74b2f22f30045"`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "PK_a59d62cda8101214445e295cdc8" PRIMARY KEY ("user_id")`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP COLUMN "follower_id"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "PK_a59d62cda8101214445e295cdc8"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP COLUMN "user_id"`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD "usersId_2" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "PK_68e594a8874a92aa113ae7525df" PRIMARY KEY ("usersId_2")`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD "usersId_1" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "PK_68e594a8874a92aa113ae7525df"`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "PK_cbd7f8b8e397b3867f245daf264" PRIMARY KEY ("usersId_1", "usersId_2")`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9caa26a2d5be8c75341e2b73e3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6b7c3ebae0d38d5a69aa4c2f0"`);
        await queryRunner.query(`DROP TABLE "faculty_subscriptions"`);
        await queryRunner.query(`CREATE INDEX "IDX_68e594a8874a92aa113ae7525d" ON "user_followers" ("usersId_2") `);
        await queryRunner.query(`CREATE INDEX "IDX_e2c80e08dfc872dae9aa64efbb" ON "user_followers" ("usersId_1") `);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_68e594a8874a92aa113ae7525df" FOREIGN KEY ("usersId_2") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_e2c80e08dfc872dae9aa64efbbf" FOREIGN KEY ("usersId_1") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

}
