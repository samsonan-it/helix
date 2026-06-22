-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "assigned_pm_id" TEXT;

-- CreateIndex
CREATE INDEX "idx_projects_assigned_pm" ON "projects"("assigned_pm_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_assigned_pm_id_fkey" FOREIGN KEY ("assigned_pm_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
