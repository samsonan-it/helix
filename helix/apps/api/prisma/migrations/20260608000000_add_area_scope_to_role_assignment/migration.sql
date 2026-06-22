-- AlterTable: add area_id column to user_role_assignments
ALTER TABLE "user_role_assignments" ADD COLUMN "area_id" TEXT;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_area_id_fkey"
  FOREIGN KEY ("area_id") REFERENCES "small_project_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropIndex: old unique constraint (user_id, role, scope_id)
DROP INDEX "user_role_assignments_user_id_role_scope_id_key";

-- CreateIndex: new unique constraint (user_id, role, scope_id, area_id)
CREATE UNIQUE INDEX "user_role_assignments_user_id_role_scope_id_area_id_key"
  ON "user_role_assignments"("user_id", "role", "scope_id", "area_id");
