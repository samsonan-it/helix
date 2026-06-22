CREATE TABLE "financial_plans" (
  "id"          TEXT        NOT NULL,
  "demand_id"   TEXT        NOT NULL,
  "year"        INTEGER     NOT NULL,
  "month"       INTEGER     NOT NULL CHECK ("month" BETWEEN 1 AND 12),
  "opex_cents"  INTEGER     NOT NULL DEFAULT 0,
  "capex_cents" INTEGER     NOT NULL DEFAULT 0,
  "is_actual"   BOOLEAN     NOT NULL DEFAULT FALSE,
  "is_user_set" BOOLEAN     NOT NULL DEFAULT FALSE,

  CONSTRAINT "financial_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_financial_plan_demand_year_month" UNIQUE ("demand_id", "year", "month"),
  CONSTRAINT "financial_plans_demand_id_fkey"
    FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_financial_plans_demand" ON "financial_plans"("demand_id");
