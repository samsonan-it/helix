-- AlterEnum: add DRAFT and PENDING_APPROVAL before IN_EXECUTION
-- PostgreSQL requires a separate committed transaction before new enum values can be used as defaults.
-- The default change is applied in the next migration (add_project_draft_default).
ALTER TYPE "ProjectStatus" ADD VALUE 'DRAFT';
ALTER TYPE "ProjectStatus" ADD VALUE 'PENDING_APPROVAL';

-- AlterTable: add current_stage column (new enum default is set in next migration)
ALTER TABLE "projects" ADD COLUMN "current_stage" TEXT;
