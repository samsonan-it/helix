-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "demand_priority" TEXT,
ADD COLUMN     "eligible_for_ppp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "investment_approval" TEXT,
ADD COLUMN     "it_project_manager_id" TEXT,
ADD COLUMN     "project_type" TEXT;

-- CreateIndex
CREATE INDEX "idx_demands_it_pm" ON "demands"("it_project_manager_id");

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_it_project_manager_id_fkey" FOREIGN KEY ("it_project_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
