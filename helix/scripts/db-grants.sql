-- db-grants.sql — Database role setup and privilege configuration
--
-- WHEN TO RUN:
--   After `prisma migrate deploy` on first deploy of a new environment,
--   and whenever role permissions need to change.
--   Must be run by a PostgreSQL superuser (e.g. postgres).
--
-- IDEMPOTENT: safe to re-run — IF NOT EXISTS guards, and GRANT/REVOKE are no-ops
--             if permissions already match.
--
-- Example:
--   psql -U postgres -d helix -f scripts/db-grants.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'helix_app') THEN
    CREATE ROLE helix_app WITH LOGIN;
  END IF;
END
$$;

-- Grant base read/write access to helix_app on all current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO helix_app;

-- Restrict audit_log to tamper-proof (NFR12 — append-only at DB grant layer)
-- UPDATE and DELETE are revoked so the application cannot edit or delete audit records.
-- SELECT is intentionally retained — the app will need to query audit history for admin UIs.
-- The meaningful protection is against tampering, not against reads.
REVOKE UPDATE, DELETE ON TABLE audit_log FROM helix_app;

-- Ensure future tables (created by later migrations) also get base access automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO helix_app;
