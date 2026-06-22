# Helix — AI Agent Enforcement Rules

This file is read by every AI agent working in this repository. Follow all rules below without exception.

## Enforcement Rules

1. **Import shared schemas from `@helix/shared`** — never redefine Zod schemas or domain types locally. `packages/shared` is the single source of truth.
2. **Import shared TypeScript types from `@helix/types`** — never redefine `Role`, `AuthUser`, `AuditLog`, or other types locally.
3. **Read feature flags ONLY via `FlagService.get(key)` (API) or `useFlags()` hook (web)** — never query the database or read env vars for flag values directly.
4. **Use `withDemandLock()` for ALL demand status transitions** — never call `prisma.demand.update()` directly for state changes. Every transition must go through `withDemandLock()`.
5. **Reference `queryKeys.*` factory for ALL TanStack Query keys** — never inline string arrays in `useQuery`/`useMutation` calls.
6. **Set API base URL from `import.meta.env.VITE_API_URL`** — never hardcode a URL, never provide a default fallback value. If the env var is missing, throw at startup.
6a. **Set DIAL endpoint from `DIAL_API_URL` env var** — never hardcode a DIAL URL. `DIAL_API_URL` must be an EU-hosted EPAM DIAL instance (NFR6). Absence of `DIAL_API_URL` or `DIAL_API_KEY` activates stub mode — no error thrown. The `ai_prefill` feature flag must remain `false` in production until Art. 28 DPA is signed and AI governance is approved (Q-005).
7. **Use `@CurrentUser()` decorator — never access `request.user` directly in controllers.**
8. **Write the audit log entry as the LAST action in every state-changing transaction** — every `tx.demand.update(...)` for a status change must be followed by `tx.auditLog.create(...)` in the same transaction.
9. **Use ISO 8601 strings for all date/time in API payloads** — never Unix timestamps or non-standard formats.
10. **Store monetary values as integer euro cents — NEVER floats.** `400.50 EUR` is stored as `40050`. The `MonetaryValue` Zod type in `@helix/shared` enforces this.
11. **Before implementing any UI component or theme token, verify against `Outputs/1-planning/design-system.md`** — the canonical design system. Colours, spacing, radius, typography, shell, component defaults, and the colour-usage and status-colour rules must match it exactly, and every UI PR must pass its §11 enforcement checklist. (`ux-design-specification.md` remains canonical for interaction design, journeys, and flows; its visual sections defer to the design system.) If your change would diverge, stop and raise it; do not silently adopt a different value.

## Anti-Patterns — Never Do These

```typescript
// ❌ Local type redefinition — import from @helix/shared or @helix/types instead
type CreateDemandInput = { title: string; description: string; }

// ❌ Direct flag DB query — use FlagService.get(FlagKeys.AI_PREFILL) instead
await prisma.config.findFirst({ where: { key: 'ai_prefill' } })

// ❌ Inline query key — use queryKeys.demands.detail(id) instead
useQuery({ queryKey: ['demands', id], ... })

// ❌ Hardcoded API URL or fallback default — VITE_API_URL must never have a default
baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// ❌ Float for money — store as integer euro cents instead
totalOpex: 400.50

// ❌ Demand state change without lock — use withDemandLock() instead
await prisma.demand.update({ where: { id }, data: { status: 'APPROVED' } })

// ❌ State-changing transaction with no audit log — always follow with auditLog.create
await tx.demand.update({ where: { id }, data: { status: 'APPROVED' } })
// missing: await tx.auditLog.create(...)

// ❌ Accessing request.user directly in a controller action
@Get(':id')
async get(@Req() req: Request) { return req.user; }  // use @CurrentUser() instead
```

## Architecture Deviations (Known, Tracked)

The following deviations from the architecture spec exist in the current codebase and are tracked for future stories. Do **not** fix them without an explicit story assignment.

| Deviation | Current State | Target State | Fix Story |
|-----------|--------------|--------------|-----------|
| Auth pattern | ✅ Resolved — server-side OAuth2 + httpOnly cookie (Stories 9.1 + 9.2) | — | Done |
| Mantine version | v8 installed (upgraded from v7 in Story 1.4) | v9 (deferred — requires React 19) | TBD |
| API prefix | `api/v1` | `api` | TBD |
| Test framework (API) | Jest | Vitest | TBD |
| Prisma version | 6.x | 7.x | TBD |
| AuditModule PrismaClient | `new PrismaClient()` in AuditModule | Same (deliberate — prevents audit middleware recursion) | N/A |

## Epic 1 Policy

For all stories in Epic 1: the `helix/` monorepo contains pre-existing code that may diverge from the spec. Whenever spec and existing code conflict, **stop and ask** which is correct. Do not silently adopt either side. Wait for explicit guidance before writing or changing affected code.
