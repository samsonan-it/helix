-- CreateTable
CREATE TABLE "project_financial_plan_entries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "gl_account_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "value_cents" INTEGER NOT NULL DEFAULT 0,
    "is_actual" BOOLEAN NOT NULL DEFAULT false,
    "is_user_set" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_financial_plan_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_financial_plan_entries_project_id_idx" ON "project_financial_plan_entries"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_financial_plan_entries_project_id_gl_account_id_cat_key" ON "project_financial_plan_entries"("project_id", "gl_account_id", "category", "month", "year");

-- AddForeignKey
ALTER TABLE "project_financial_plan_entries" ADD CONSTRAINT "project_financial_plan_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_financial_plan_entries" ADD CONSTRAINT "project_financial_plan_entries_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
