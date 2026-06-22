-- Migration: add updated_at / updated_by to reference data tables
-- Story 3.2 — nullable so seeded records that pre-date this migration are unaffected

ALTER TABLE "cost_centres" ADD COLUMN "updated_at" TIMESTAMP(3);
ALTER TABLE "cost_centres" ADD COLUMN "updated_by" TEXT;

ALTER TABLE "gl_accounts" ADD COLUMN "updated_at" TIMESTAMP(3);
ALTER TABLE "gl_accounts" ADD COLUMN "updated_by" TEXT;

ALTER TABLE "legal_entities" ADD COLUMN "updated_at" TIMESTAMP(3);
ALTER TABLE "legal_entities" ADD COLUMN "updated_by" TEXT;

ALTER TABLE "small_project_areas" ADD COLUMN "updated_at" TIMESTAMP(3);
ALTER TABLE "small_project_areas" ADD COLUMN "updated_by" TEXT;
