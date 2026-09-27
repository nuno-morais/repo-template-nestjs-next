import { MigrationInterface, QueryRunner } from 'typeorm';
export class InitialSchema20260927120000 implements MigrationInterface {
  name = 'InitialSchema20260927120000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(
      'CREATE TABLE "widgets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" varchar(120) NOT NULL, "name" varchar(255) NOT NULL, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_widgets" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_widgets_organization_id" ON "widgets" ("organization_id")',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "widgets"');
  }
}
