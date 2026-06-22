-- AlterTable
ALTER TABLE "config" ADD COLUMN     "updated_by" TEXT;

-- RenameIndex
ALTER INDEX "uq_line_item_type_section_label" RENAME TO "financial_line_item_types_section_key_label_key";

-- RenameIndex
ALTER INDEX "uq_financial_plan_entry" RENAME TO "financial_plan_entries_demand_id_line_item_type_id_month_ye_key";
