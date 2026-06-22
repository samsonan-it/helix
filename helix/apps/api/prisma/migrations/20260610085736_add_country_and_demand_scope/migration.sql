-- DropForeignKey
ALTER TABLE "financial_plan_entries" DROP CONSTRAINT "financial_plan_entries_gl_account_id_fkey";

-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "country_id" TEXT,
ADD COLUMN     "demand_scope" TEXT;

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "updated_by" TEXT,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE INDEX "idx_demands_country" ON "demands"("country_id");

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_plan_entries" ADD CONSTRAINT "financial_plan_entries_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "uq_financial_plan_entry" RENAME TO "financial_plan_entries_demand_id_gl_account_id_category_mon_key";
