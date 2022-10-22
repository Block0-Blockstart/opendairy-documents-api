import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1664407279526 implements MigrationInterface {
    name = 'InitialMigration1664407279526'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "ethAddress" varchar, "pubKey" varchar, "emailHash" varchar, "lastNonceUsed" integer, "deleted" boolean NOT NULL)`);
        await queryRunner.query(`CREATE TABLE "document_request" ("id" varchar PRIMARY KEY NOT NULL, "requestDate" integer NOT NULL, "deadline" integer, "documentType" varchar CHECK( "documentType" IN ('COO','COA','Health/Veterinary','MUI Halal certified','MUI Singapore Halal Certified','Jakim Halal Certified','Radioactivity','Waiver','Packing list','Other customs documents','B / L','B / L Telex release','Booking sheet','EUR1','Invoice','Commercial invoice / packing list','Kosher','Master B / L','MSDS','Shipping Labels','Warehouse Receipt','Import Permit','Quality Certification','Seaway Bill') ) NOT NULL, "requestedById" varchar, "requestedToId" varchar)`);
        await queryRunner.query(`CREATE TABLE "document_delivery" ("id" varchar PRIMARY KEY NOT NULL, "sentDate" integer NOT NULL, "verificationHash" varchar NOT NULL, "rejectionReason" varchar, "url" varchar NOT NULL, "status" varchar CHECK( "status" IN ('TO_BE_REVIEWED','UPDATE_REQUIRED','ACCEPTED','REJECTED','DROPPED') ) NOT NULL, "documentRequestId" varchar)`);
        await queryRunner.query(`CREATE TABLE "temporary_document_request" ("id" varchar PRIMARY KEY NOT NULL, "requestDate" integer NOT NULL, "deadline" integer, "documentType" varchar CHECK( "documentType" IN ('COO','COA','Health/Veterinary','MUI Halal certified','MUI Singapore Halal Certified','Jakim Halal Certified','Radioactivity','Waiver','Packing list','Other customs documents','B / L','B / L Telex release','Booking sheet','EUR1','Invoice','Commercial invoice / packing list','Kosher','Master B / L','MSDS','Shipping Labels','Warehouse Receipt','Import Permit','Quality Certification','Seaway Bill') ) NOT NULL, "requestedById" varchar, "requestedToId" varchar, CONSTRAINT "FK_7240458945f01f135692003157e" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_d8c4e7f85c7b5630fe5cdd3dc29" FOREIGN KEY ("requestedToId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_document_request"("id", "requestDate", "deadline", "documentType", "requestedById", "requestedToId") SELECT "id", "requestDate", "deadline", "documentType", "requestedById", "requestedToId" FROM "document_request"`);
        await queryRunner.query(`DROP TABLE "document_request"`);
        await queryRunner.query(`ALTER TABLE "temporary_document_request" RENAME TO "document_request"`);
        await queryRunner.query(`CREATE TABLE "temporary_document_delivery" ("id" varchar PRIMARY KEY NOT NULL, "sentDate" integer NOT NULL, "verificationHash" varchar NOT NULL, "rejectionReason" varchar, "url" varchar NOT NULL, "status" varchar CHECK( "status" IN ('TO_BE_REVIEWED','UPDATE_REQUIRED','ACCEPTED','REJECTED','DROPPED') ) NOT NULL, "documentRequestId" varchar, CONSTRAINT "FK_0c7b4532e4ee0cc380d67b0ba9c" FOREIGN KEY ("documentRequestId") REFERENCES "document_request" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_document_delivery"("id", "sentDate", "verificationHash", "rejectionReason", "url", "status", "documentRequestId") SELECT "id", "sentDate", "verificationHash", "rejectionReason", "url", "status", "documentRequestId" FROM "document_delivery"`);
        await queryRunner.query(`DROP TABLE "document_delivery"`);
        await queryRunner.query(`ALTER TABLE "temporary_document_delivery" RENAME TO "document_delivery"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "document_delivery" RENAME TO "temporary_document_delivery"`);
        await queryRunner.query(`CREATE TABLE "document_delivery" ("id" varchar PRIMARY KEY NOT NULL, "sentDate" integer NOT NULL, "verificationHash" varchar NOT NULL, "rejectionReason" varchar, "url" varchar NOT NULL, "status" varchar CHECK( "status" IN ('TO_BE_REVIEWED','UPDATE_REQUIRED','ACCEPTED','REJECTED','DROPPED') ) NOT NULL, "documentRequestId" varchar)`);
        await queryRunner.query(`INSERT INTO "document_delivery"("id", "sentDate", "verificationHash", "rejectionReason", "url", "status", "documentRequestId") SELECT "id", "sentDate", "verificationHash", "rejectionReason", "url", "status", "documentRequestId" FROM "temporary_document_delivery"`);
        await queryRunner.query(`DROP TABLE "temporary_document_delivery"`);
        await queryRunner.query(`ALTER TABLE "document_request" RENAME TO "temporary_document_request"`);
        await queryRunner.query(`CREATE TABLE "document_request" ("id" varchar PRIMARY KEY NOT NULL, "requestDate" integer NOT NULL, "deadline" integer, "documentType" varchar CHECK( "documentType" IN ('COO','COA','Health/Veterinary','MUI Halal certified','MUI Singapore Halal Certified','Jakim Halal Certified','Radioactivity','Waiver','Packing list','Other customs documents','B / L','B / L Telex release','Booking sheet','EUR1','Invoice','Commercial invoice / packing list','Kosher','Master B / L','MSDS','Shipping Labels','Warehouse Receipt','Import Permit','Quality Certification','Seaway Bill') ) NOT NULL, "requestedById" varchar, "requestedToId" varchar)`);
        await queryRunner.query(`INSERT INTO "document_request"("id", "requestDate", "deadline", "documentType", "requestedById", "requestedToId") SELECT "id", "requestDate", "deadline", "documentType", "requestedById", "requestedToId" FROM "temporary_document_request"`);
        await queryRunner.query(`DROP TABLE "temporary_document_request"`);
        await queryRunner.query(`DROP TABLE "document_delivery"`);
        await queryRunner.query(`DROP TABLE "document_request"`);
        await queryRunner.query(`DROP TABLE "user"`);
    }

}
