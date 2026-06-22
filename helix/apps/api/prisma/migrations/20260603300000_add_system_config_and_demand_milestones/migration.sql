-- CreateTable
CREATE TABLE "system_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "demand_milestones" (
    "id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "milestone_type" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_milestones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "demand_milestones" ADD CONSTRAINT "demand_milestones_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateUniqueIndex (skipDuplicates requires a unique constraint to work)
CREATE UNIQUE INDEX "demand_milestones_demand_id_milestone_type_key" ON "demand_milestones"("demand_id", "milestone_type");

-- CreateIndex (FK column index — PostgreSQL does not auto-create these)
CREATE INDEX "demand_milestones_demand_id_idx" ON "demand_milestones"("demand_id");
