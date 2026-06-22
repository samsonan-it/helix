-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "pm_actioned_at" TIMESTAMP(3),
ADD COLUMN     "pm_actioned_by" TEXT,
ADD COLUMN     "pm_commentary" TEXT;

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_demand_id_key" ON "projects"("demand_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
