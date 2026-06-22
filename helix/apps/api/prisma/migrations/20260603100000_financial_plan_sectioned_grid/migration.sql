-- Story 2.9: Financial Planning — Sectioned Grid
-- Drops the old financial_plans table (no data migration needed per story spec).
-- Creates financial_line_item_types and financial_plan_entries tables.

-- Drop old table
DROP TABLE IF EXISTS "financial_plans";

-- Create financial_line_item_types
CREATE TABLE "financial_line_item_types" (
    "id"           TEXT NOT NULL,
    "section_key"  TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "financial_line_item_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_line_item_type_section_label" UNIQUE ("section_key", "label")
);

-- Create financial_plan_entries
CREATE TABLE "financial_plan_entries" (
    "id"               TEXT NOT NULL,
    "demand_id"        TEXT NOT NULL,
    "line_item_type_id" TEXT NOT NULL,
    "month"            INTEGER NOT NULL,
    "year"             INTEGER NOT NULL,
    "value_cents"      INTEGER NOT NULL DEFAULT 0,
    "is_actual"        BOOLEAN NOT NULL DEFAULT false,
    "is_user_set"      BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "financial_plan_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_financial_plan_entry" UNIQUE ("demand_id", "line_item_type_id", "month", "year")
);

CREATE INDEX "financial_plan_entries_demand_id_idx" ON "financial_plan_entries"("demand_id");

ALTER TABLE "financial_plan_entries"
    ADD CONSTRAINT "financial_plan_entries_demand_id_fkey"
    FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_plan_entries"
    ADD CONSTRAINT "financial_plan_entries_line_item_type_id_fkey"
    FOREIGN KEY ("line_item_type_id") REFERENCES "financial_line_item_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
