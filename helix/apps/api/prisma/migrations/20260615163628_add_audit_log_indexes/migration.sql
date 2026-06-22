-- CreateIndex
CREATE INDEX "idx_audit_log_changed_at" ON "audit_log"("changed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_changed_by" ON "audit_log"("changed_by");
