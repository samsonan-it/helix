-- CreateTable
CREATE TABLE "project_plan_items" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "project_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_project_plan_items_project" ON "project_plan_items"("project_id");

-- AddForeignKey
ALTER TABLE "project_plan_items" ADD CONSTRAINT "project_plan_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
