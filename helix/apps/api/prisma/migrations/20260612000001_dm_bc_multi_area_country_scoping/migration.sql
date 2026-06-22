-- Add new array columns
ALTER TABLE "user_role_assignments" ADD COLUMN "area_ids" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "user_role_assignments" ADD COLUMN "country_ids" TEXT[] NOT NULL DEFAULT '{}';

-- Drop old unique constraint (covers userId, role, scopeId, areaId)
ALTER TABLE "user_role_assignments"
  DROP CONSTRAINT IF EXISTS "user_role_assignments_user_id_role_scope_id_area_id_key";

-- Add new unique constraint (userId, role, scopeId only)
ALTER TABLE "user_role_assignments"
  ADD CONSTRAINT "user_role_assignments_user_id_role_scope_id_key"
  UNIQUE ("user_id", "role", "scope_id");

-- Drop FK constraint and old areaId column
ALTER TABLE "user_role_assignments" DROP COLUMN IF EXISTS "area_id";
