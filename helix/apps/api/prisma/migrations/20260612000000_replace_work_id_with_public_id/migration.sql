-- Drop the old extensibility slot that was never populated
ALTER TABLE "demands" DROP COLUMN IF EXISTS "work_id";

-- Add public_id as an auto-incrementing integer, unique across all demands
ALTER TABLE "demands" ADD COLUMN "public_id" SERIAL NOT NULL;

-- Unique index (mirrors @unique in Prisma schema)
CREATE UNIQUE INDEX "demands_public_id_key" ON "demands"("public_id");
