-- Story 4.11: Business Controller Workflow
-- Adds bc_actioned_at and bc_actioned_by to demands table.
-- businessControllerId and bc_status already exist from ARCH-10 extensibility slots.

ALTER TABLE "demands" ADD COLUMN "bc_actioned_at" TIMESTAMP(3);
ALTER TABLE "demands" ADD COLUMN "bc_actioned_by" TEXT;
ALTER TABLE "demands" ADD COLUMN "bc_commentary" TEXT;
