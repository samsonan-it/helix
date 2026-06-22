/*
  Warnings:

  - Added the required column `description` to the `demands` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originator_id` to the `demands` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `demands` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "bc_status" TEXT,
ADD COLUMN     "business_controller_id" TEXT,
ADD COLUMN     "cost_centre_id" TEXT,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "draft_saved_at" TIMESTAMP(3),
ADD COLUMN     "end_date" TIMESTAMP(3),
ADD COLUMN     "notification_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "originator_id" TEXT NOT NULL,
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "title" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "idx_demands_originator" ON "demands"("originator_id");

-- CreateIndex
CREATE INDEX "idx_demands_status" ON "demands"("status");

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_originator_id_fkey" FOREIGN KEY ("originator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_cost_centre_id_fkey" FOREIGN KEY ("cost_centre_id") REFERENCES "cost_centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
