-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('IN_EXECUTION', 'ASSUMED_COMPLETED', 'PREPARE_FOR_CLOSURE', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'IN_EXECUTION';

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_business_controller_id_fkey" FOREIGN KEY ("business_controller_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
