-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "closure_financial_reconciled" BOOLEAN,
ADD COLUMN     "closure_handover_document_path" TEXT,
ADD COLUMN     "closure_pm_summary_notes" TEXT,
ADD COLUMN     "closure_submitted_at" TIMESTAMP(3),
ADD COLUMN     "closure_work_delivered" BOOLEAN;
