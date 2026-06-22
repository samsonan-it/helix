# Helix

Stada IT demand intake and portfolio management system.

**Stack:** NestJS API · Vite/React SPA · PostgreSQL · Prisma · pnpm workspaces + Turborepo

---

## Docker Quick Start

> Runs the full stack (PostgreSQL + API + Web) in Docker — no local Node or Postgres required.
> Migrations run automatically on first boot.

```bash
# From the helix/ directory:
docker-compose up --build

# seed DB with test data (optional) 
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/helix_dev pnpm --filter @helix/api exec prisma db seed
```

| Service | URL                               |
|---------|-----------------------------------|
| Web UI | http://localhost:8080             |
| API (direct) | http://localhost:3000             |
| Swagger UI | http://localhost:3000/api/v1/docs |
| PostgreSQL | localhost:5432                    |

**No `.env` files needed** — `docker-compose.yml` provides all dev defaults.

**Dev login** (Azure AD not required):
```bash
# List seed users
curl http://localhost:8080/api/v1/auth/dev-users

# Log in as a seed user
curl -X POST http://localhost:8080/api/v1/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"userId": "<id from above>"}'
```

**Enable feature flags locally** (off by default — some are gated on external sign-off):
```bash
# Example: enable AI prefill modal (off until DPA signed in production)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/helix_dev \
  pnpm --filter @helix/api exec prisma db execute --stdin <<'SQL'
UPDATE "config" SET value = 'true' WHERE key = 'ai_prefill';
SQL
```
Alternatively, edit `apps/api/prisma/seed.ts`, set the flag's `value` to `true`, re-run `prisma db seed`, then revert before committing.

**Stop and clean up:**
```bash
docker-compose down        # stop containers, keep DB volume
docker-compose down -v     # stop containers and delete DB volume
```

---

## Prerequisites

- Node.js ≥ 22.13 (required by pnpm 11)
- pnpm ≥ 11 (`corepack enable && corepack use pnpm@11`)
- PostgreSQL running locally (default: `localhost:5432`)

---

## Quick Start

```bash
# 1. Install all dependencies
pnpm install

# 2. Copy env files and fill in values (see Environment Variables below)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Run database migrations - happens automatically
cd apps/api && pnpm exec prisma migrate dev && cd ../..

# 4. (Optional) Seed dev users
cd apps/api && pnpm exec prisma db seed && cd ../..

# 5. Start both API and web in watch mode
pnpm dev
```

- **API** → http://localhost:3000
- **Web** → http://localhost:8080
- **Swagger UI** → http://localhost:3000/api/v1/docs (non-production only)

---

## Environment Variables

### `apps/api/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5432/helix_dev` | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Secret for signing JWTs — change in production |
| `NODE_ENV` | — | `development` | Set to `production` to disable Swagger |
| `CORS_ORIGIN` | — | `http://localhost:8080` | Allowed CORS origin |
| `AZURE_AD_TENANT_ID` | Azure auth only | — | Azure AD tenant ID |
| `AZURE_AD_CLIENT_ID` | Azure auth only | — | Azure AD application (client) ID |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | — | — | Azure App Insights (leave empty in dev) |

### `apps/web/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | ✅ | — | Full API base URL, e.g. `http://localhost:3000/api/v1`. **Never hardcode or omit — the app throws at startup if missing.** |
| `VITE_AZURE_AD_CLIENT_ID` | Azure auth only | — | Azure AD application (client) ID |
| `VITE_AZURE_AD_TENANT_ID` | Azure auth only | — | Azure AD tenant ID |
| `VITE_AZURE_AD_REDIRECT_URI` | Azure auth only | `http://localhost:8080` | OAuth redirect URI |

---

## Project Structure

```
helix/
├── apps/
│   ├── api/          # NestJS API (@helix/api) — port 3000
│   └── web/          # Vite + React SPA (@helix/web) — port 8080
├── packages/
│   ├── shared/       # Zod schemas + domain types (@helix/shared)
│   ├── types/        # TypeScript-only types (@helix/types)
│   └── ui/           # Shared React components (@helix/ui)
├── CLAUDE.md         # AI agent enforcement rules
├── turbo.json        # Turborepo task pipeline
└── pnpm-workspace.yaml
```

### Key API paths

| Path | Description |
|------|-------------|
| `GET /api/v1/health` | Health check (DB connectivity) |
| `GET /api/v1/auth/me` | Current authenticated user |
| `GET /api/v1/auth/dev-users` | Dev seed users list (dev mode only) |
| `POST /api/v1/auth/dev-login` | Issue JWT for a dev user (dev mode only) |
| `GET /api/v1/docs` | Swagger UI (non-production only) |

---

## Common Commands

```bash
# Development (all packages in parallel)
pnpm dev

# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint all packages
pnpm lint

# Type-check all packages
pnpm type-check

# API only
cd apps/api && pnpm dev

# Web only
cd apps/web && pnpm dev
```

### Database

```bash
cd apps/api

# Run pending migrations
pnpm exec prisma migrate dev

# Open Prisma Studio (database browser)
pnpm exec prisma studio

# Seed dev users
pnpm exec prisma db seed

# Reset database (drops all data)
pnpm exec prisma migrate reset
```

---

## Authentication

**Dev mode** (`NODE_ENV=development`): use the dev-login endpoints — no Azure AD setup required.

```bash
# Get list of dev seed users
curl http://localhost:3000/api/v1/auth/dev-users

# Log in as a dev user and get a JWT
curl -X POST http://localhost:3000/api/v1/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"userId": "<id from dev-users>"}'
```

**Production**: Azure AD SSO via MSAL. Set `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID` (API) and the matching `VITE_AZURE_AD_*` variables (web).

---

## Architecture Notes

- `packages/shared` is the source of truth for all Zod schemas and domain types — never redefine them locally.
- All demand status transitions must go through `withDemandLock()` — never call `prisma.demand.update()` directly for state changes.
- Feature flags are read via `FlagService.get(FlagKeys.*)` — never query the DB directly.
- `VITE_API_URL` must never have a fallback default — the app fails at startup if it is unset.
- See `CLAUDE.md` for the full list of enforcement rules.
