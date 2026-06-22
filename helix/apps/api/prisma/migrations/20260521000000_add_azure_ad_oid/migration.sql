-- AlterTable
ALTER TABLE "users" ADD COLUMN "azure_ad_oid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_azure_ad_oid_key" ON "users"("azure_ad_oid");
