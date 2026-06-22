-- CreateEnum
CREATE TYPE "RagStatus" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateTable
CREATE TABLE "status_reports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "overall_rag" "RagStatus" NOT NULL,
    "schedule_rag" "RagStatus" NOT NULL,
    "resources_rag" "RagStatus" NOT NULL,
    "budget_current_rag" "RagStatus" NOT NULL,
    "budget_forecast_rag" "RagStatus" NOT NULL,
    "stakeholders_rag" "RagStatus" NOT NULL,
    "value_prop_rag" "RagStatus" NOT NULL,
    "provider_rag" "RagStatus" NOT NULL,
    "overall_explanation" TEXT,
    "schedule_explanation" TEXT,
    "resources_explanation" TEXT,
    "budget_current_explanation" TEXT,
    "budget_forecast_explanation" TEXT,
    "stakeholders_explanation" TEXT,
    "value_prop_explanation" TEXT,
    "provider_explanation" TEXT,
    "key_accomplishments" TEXT,
    "next_steps" TEXT,
    "go_live_date" TIMESTAMP(3),

    CONSTRAINT "status_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_status_reports_project_time" ON "status_reports"("project_id", "submitted_at" DESC);

-- AddForeignKey
ALTER TABLE "status_reports" ADD CONSTRAINT "status_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_reports" ADD CONSTRAINT "status_reports_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
