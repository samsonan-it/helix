-- DropForeignKey: demand_manager_id → persons
ALTER TABLE "demands" DROP CONSTRAINT "demands_demand_manager_id_fkey";

-- Nullify stale person IDs before re-pointing FK to users
UPDATE "demands" SET "demand_manager_id" = NULL WHERE "demand_manager_id" IS NOT NULL;

-- DropTable
DROP TABLE "persons";

-- AddForeignKey: demand_manager_id → users
ALTER TABLE "demands" ADD CONSTRAINT "demands_demand_manager_id_fkey" FOREIGN KEY ("demand_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
