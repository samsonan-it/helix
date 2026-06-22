-- DropForeignKey
ALTER TABLE "financial_plans" DROP CONSTRAINT "financial_plans_demand_id_fkey";

-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "dm_actioned_at" TIMESTAMP(3),
ADD COLUMN     "dm_actioned_by" TEXT,
ADD COLUMN     "dm_commentary" TEXT,
ADD COLUMN     "dm_decision" TEXT,
ADD COLUMN     "ea_comment" TEXT,
ADD COLUMN     "ea_involved" BOOLEAN,
ADD COLUMN     "it_ops_comment" TEXT,
ADD COLUMN     "it_ops_involved" BOOLEAN,
ADD COLUMN     "it_security_comment" TEXT,
ADD COLUMN     "it_security_involved" BOOLEAN,
ADD COLUMN     "move_to_small_project" BOOLEAN,
ADD COLUMN     "on_hold_reason" TEXT,
ADD COLUMN     "top10_conformity" TEXT,
ADD COLUMN     "top10_conformity_comments" TEXT,
ALTER COLUMN "submitted_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "financial_plans" ADD CONSTRAINT "financial_plans_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "uq_financial_plan_demand_year_month" RENAME TO "financial_plans_demand_id_year_month_key";
