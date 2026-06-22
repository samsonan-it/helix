-- Migration: gl_account_category
-- Unifies FinancialLineItemType → GlAccount; adds categories (array) to gl_accounts;
-- adds per-entry category to financial_plan_entries

-- 1. Clean slate: no rows means no FK/NOT NULL issue later
TRUNCATE TABLE financial_plan_entries;

-- 2. Remove old FK column first (drops the constraint that blocks table drop)
ALTER TABLE financial_plan_entries DROP COLUMN line_item_type_id;

-- 3. Remove the now-redundant table
DROP TABLE financial_line_item_types;

-- 4. Add categories array column (replaces singular category concept)
ALTER TABLE gl_accounts ADD COLUMN categories TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE gl_accounts ALTER COLUMN categories DROP DEFAULT;
ALTER TABLE gl_accounts ADD CONSTRAINT chk_gl_account_categories
  CHECK (array_length(categories, 1) > 0);

-- 5. Add per-entry category and new FK to financial_plan_entries
--    Table is empty from step 1, so NOT NULL columns need no defaults
ALTER TABLE financial_plan_entries ADD COLUMN category TEXT NOT NULL;
ALTER TABLE financial_plan_entries ADD CONSTRAINT chk_fp_entry_category
  CHECK (category IN ('benefits', 'opex', 'capex'));
ALTER TABLE financial_plan_entries ADD COLUMN gl_account_id TEXT NOT NULL
  REFERENCES gl_accounts(id) ON DELETE RESTRICT;

-- 6. New unique constraint: (demand, gl_account, category, month, year)
DROP INDEX IF EXISTS "uq_financial_plan_entry";
ALTER TABLE financial_plan_entries ADD CONSTRAINT uq_financial_plan_entry
  UNIQUE (demand_id, gl_account_id, category, month, year);
