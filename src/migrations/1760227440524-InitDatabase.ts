import { MigrationInterface, QueryRunner } from "typeorm";

export class InitDatabase1760227440524 implements MigrationInterface {
    name = 'InitDatabase1760227440524'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "message" character varying NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "subjects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, CONSTRAINT "PK_1a023685ac2b051b4e557b0b280" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "faculties" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, CONSTRAINT "PK_fd83e4a09c7182ccf7bdb3770b9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "score" double precision NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "documentId" uuid, CONSTRAINT "UQ_59d77e3c352aa1c986317206401" UNIQUE ("userId", "documentId"), CONSTRAINT "PK_0f31425b073219379545ad68ed9" PRIMARY KEY ("id")); COMMENT ON COLUMN "ratings"."score" IS 'Score từ 1 đến 5'`);
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "documentId" uuid, CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "fileUrl" character varying NOT NULL, "downloadCount" integer NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'pending', "uploadDate" TIMESTAMP NOT NULL DEFAULT now(), "uploaderId" uuid, "subjectId" uuid, "facultyId" uuid, CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_subjects" ("usersId" uuid NOT NULL, "subjectsId" uuid NOT NULL, CONSTRAINT "PK_deeb892bdcfc87a24a9b38420a4" PRIMARY KEY ("usersId", "subjectsId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4e5ec27815bbc9ef07b943e3fe" ON "user_subjects" ("usersId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dac8a5e418b655005e7dcea437" ON "user_subjects" ("subjectsId") `);
        await queryRunner.query(`CREATE TABLE "user_faculties" ("usersId" uuid NOT NULL, "facultiesId" uuid NOT NULL, CONSTRAINT "PK_6abb444b87fae83b308ff70dbb3" PRIMARY KEY ("usersId", "facultiesId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2a5b61b886af792c484c96b296" ON "user_faculties" ("usersId") `);
        await queryRunner.query(`CREATE INDEX "IDX_79b6b70c1fe3b77c1494179fdb" ON "user_faculties" ("facultiesId") `);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_4d0b0e3a4c4af854d225154ba40" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_bf2b7eceb0a1df16f942888630e" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_aa715016eed08ad03a184c1ad2e" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_befd700a02312da4cc725ccaace" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_88a8881bddb8f5bd5127aa164c1" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_bff6f075d96fe9259bf2609c8cd" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_subjects" ADD CONSTRAINT "FK_4e5ec27815bbc9ef07b943e3feb" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_subjects" ADD CONSTRAINT "FK_dac8a5e418b655005e7dcea4375" FOREIGN KEY ("subjectsId") REFERENCES "subjects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_faculties" ADD CONSTRAINT "FK_2a5b61b886af792c484c96b2963" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_faculties" ADD CONSTRAINT "FK_79b6b70c1fe3b77c1494179fdbf" FOREIGN KEY ("facultiesId") REFERENCES "faculties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_faculties" DROP CONSTRAINT "FK_79b6b70c1fe3b77c1494179fdbf"`);
        await queryRunner.query(`ALTER TABLE "user_faculties" DROP CONSTRAINT "FK_2a5b61b886af792c484c96b2963"`);
        await queryRunner.query(`ALTER TABLE "user_subjects" DROP CONSTRAINT "FK_dac8a5e418b655005e7dcea4375"`);
        await queryRunner.query(`ALTER TABLE "user_subjects" DROP CONSTRAINT "FK_4e5ec27815bbc9ef07b943e3feb"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_bff6f075d96fe9259bf2609c8cd"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_88a8881bddb8f5bd5127aa164c1"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_befd700a02312da4cc725ccaace"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_aa715016eed08ad03a184c1ad2e"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_bf2b7eceb0a1df16f942888630e"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_4d0b0e3a4c4af854d225154ba40"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_79b6b70c1fe3b77c1494179fdb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2a5b61b886af792c484c96b296"`);
        await queryRunner.query(`DROP TABLE "user_faculties"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dac8a5e418b655005e7dcea437"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e5ec27815bbc9ef07b943e3fe"`);
        await queryRunner.query(`DROP TABLE "user_subjects"`);
        await queryRunner.query(`DROP TABLE "documents"`);
        await queryRunner.query(`DROP TABLE "comments"`);
        await queryRunner.query(`DROP TABLE "ratings"`);
        await queryRunner.query(`DROP TABLE "faculties"`);
        await queryRunner.query(`DROP TABLE "subjects"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
    }

}
