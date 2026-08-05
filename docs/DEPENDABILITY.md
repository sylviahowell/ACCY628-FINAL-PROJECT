# RowanLane dependability (pitch / writeup framing)

RowanLane is a freight **contract-to-cash** demo for ACCY628. Dependability is framed as **defense in depth** appropriate for a course pitch—not an enterprise SOC2 claim.

## What judges should hear

1. **Portal RBAC (application layer)**  
   Middleware and `roles.ts` keep each persona on its own menu paths. Sensitive pages call `requirePathAccess`. Mutations in server actions check role (broker ops, billing, manager approvals, shipper disputes).

2. **Tenant / role RLS (data layer)**  
   Supabase Row Level Security is enabled on public tables. Staff, shipper, and carrier policies use `auth.uid()` and `current_role()`. Policies are versioned under `supabase/migrations/` so teammates cannot silently drift.

3. **Business governance (product controls)**  
   Accessorial approval thresholds, POD-before-invoice, credit checks at booking, expired-insurance hard blocks, disputed invoices blocked from any payment, and status/audit tables (`shipment_status_updates`, `status_events`) encode operational governance—not just UI chrome. See [INTERNAL_CONTROLS.md](./INTERNAL_CONTROLS.md) for the SoD matrix, residual risk register, and demo script.

4. **Honest demo tradeoffs**  
   Shared demo accounts and passwordless **Explore Demo Portals** exist for the pitch. They are env-gated (`DEMO_ENABLED`) and rate-limited. A production deploy would use a real IdP and keep demo entry off.

## Technical hardening shipped with this workstream

| Pillar | Implementation |
|--------|----------------|
| Security | Action tenant checks (POD / dispute / accessorial); profile privilege trigger; narrowed status history SELECT; anon RPC revoke; Zod on high-risk forms |
| Reliability | `error.tsx` / `global-error.tsx` / `loading.tsx` / `not-found.tsx`; success + error toasts (`toast` / `toastError`) |
| Scalability | Parallel AppShell badge loaders; narrower selects for nav counts |
| Observability | JSON `logEvent` helper; `/api/health` probe; CI lint/typecheck/build |
| Governance | Checked-in RLS migrations + README rebuild notes; Settings “System control policies”, `/controls` activity log, and [INTERNAL_CONTROLS.md](./INTERNAL_CONTROLS.md) |

## How to rebuild / govern the DB

1. Apply foundation schema (shared project history / MCP).  
2. Apply `supabase/migrations/*.sql` in order.  
3. Re-seed with `story_seed_phase7.sql` only if demo data was wiped.  
4. Re-run Supabase **Security Advisors** after policy changes.  
5. Never put a **service-role** key in the Next.js app—anon + RLS + server actions only.

## CI

- `.github/workflows/ci.yml` runs lint, `tsc`, and `next build` on push/PR.  
- Smoke tests run on **workflow_dispatch** when repo secrets are configured (`NEXT_PUBLIC_SUPABASE_*`, optional `SMOKE_BASE_URL`).

## Pitch one-liner

> RowanLane separates **who can open a screen**, **who can mutate freight/billing data**, and **what the ledger will allow**—with timeouts, health checks, and versioned RLS so the demo stays dependable under live judging.
