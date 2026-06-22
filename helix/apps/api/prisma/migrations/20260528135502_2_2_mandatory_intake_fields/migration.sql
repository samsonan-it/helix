-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "area_id" TEXT,
ADD COLUMN     "asis_description" TEXT,
ADD COLUMN     "benefits_objectives" TEXT,
ADD COLUMN     "demand_manager_id" TEXT,
ADD COLUMN     "demand_owner" TEXT,
ADD COLUMN     "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legal_entity_id" TEXT,
ADD COLUMN     "necessity" TEXT,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "qualitative_value_category" TEXT,
ADD COLUMN     "quantitative_value_category" TEXT,
ADD COLUMN     "tobe_description" TEXT;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "small_project_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_demand_manager_id_fkey" FOREIGN KEY ("demand_manager_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
