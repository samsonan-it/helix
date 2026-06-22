-- AlterTable
ALTER TABLE "demands" ADD COLUMN "gl_account_id" TEXT;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "idx_demands_gl_account" ON "demands"("gl_account_id");
