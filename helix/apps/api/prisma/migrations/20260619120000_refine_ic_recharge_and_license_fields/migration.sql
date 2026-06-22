-- Backfill ic_recharge from old amount columns before dropping them
ALTER TABLE "projects" ADD COLUMN "ic_recharge" BOOLEAN;
ALTER TABLE "projects" ADD COLUMN "ic_recharge_alignment_conducted" BOOLEAN;
UPDATE "projects"
SET ic_recharge = CASE
  WHEN ic_recharge_opex_cents IS NOT NULL OR ic_recharge_capex_cents IS NOT NULL THEN TRUE
  ELSE FALSE
END;
ALTER TABLE "projects" DROP COLUMN "ic_recharge_opex_cents";
ALTER TABLE "projects" DROP COLUMN "ic_recharge_capex_cents";
