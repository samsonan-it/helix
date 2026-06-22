-- Story 2.8: Intake Form Field Refinements
-- Change value category columns from text to boolean
ALTER TABLE "demands"
  ALTER COLUMN "qualitative_value_category" TYPE boolean
    USING CASE WHEN "qualitative_value_category" IS NOT NULL AND "qualitative_value_category" != '' THEN TRUE ELSE FALSE END,
  ALTER COLUMN "quantitative_value_category" TYPE boolean
    USING CASE WHEN "quantitative_value_category" IS NOT NULL AND "quantitative_value_category" != '' THEN TRUE ELSE FALSE END;

-- Add reasoning_for_mandatory column
ALTER TABLE "demands"
  ADD COLUMN "reasoning_for_mandatory" text;
