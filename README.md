# FreightFlow

Freight Brokerage & Logistics contract-to-cash app for ACCY628.

## Stack
Next.js · React · Tailwind CSS · daisyUI · Supabase · Recharts · Leaflet

## Shared Supabase project (only this one)
- **Name:** ACCY628-Final-Project
- **Ref:** `hdoaultadiqdmaijcjyp`
- Do **not** use ConcertCosts

## Environment
Copy `.env.example` to `.env.local` (already created for Sylvia):

```env
NEXT_PUBLIC_SUPABASE_URL=https://hdoaultadiqdmaijcjyp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key from Supabase>
```

Never put a service-role key in the frontend.

After changing `.env.local`, **restart** the dev server (`Ctrl+C`, then `npm run dev`).

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000 (or the port shown in the terminal).

## Demo login (quick role switch)
Password for all demo users: `FreightDemo2026!`

| Email | Role | Linked org |
|-------|------|------------|
| manager@freightflow.example | Executive / Manager | — |
| broker@freightflow.example | Broker Operations | — |
| billing@freightflow.example | Billing & Accounting | — |
| customer@freightflow.example | Shipper (Customer) | Midwest Retail Group |
| carrier@freightflow.example | Carrier | Prairie Haulers LLC |

Appearance (theme) lives only under **Settings** after login.

If login fails with an email confirmation error: Supabase Dashboard → Authentication → Providers → Email → turn off **Confirm email**.

## Story seed (panel demo data)
Narrative seed is in `supabase/story_seed_phase7.sql` and is already applied on the shared Supabase project. Re-run in the SQL editor only if demo data was wiped.

Highlights:
- **Customers A–D:** Midwest (slow pay), Gulf Coast (fast pay), Cascade (disputes), Summit (credit watch)
- **Carriers:** Preferred Prairie · Watch Blue Ridge · insurance expiring Pacific · expired Midwest Reefer
- **Loads:** delayed `LD-1003`, late `LD-2010-LATE`, loss unbilled `LD-2011-LOSS`, pending accessorial `LD-2012-ACC`, missing POD `LD-2021-NOPOD`, profitable paid `LD-2020-WIN` / `INV-2020-WIN`, overdue + collection note `INV-EDGE-OVERDUE`, open dispute `INV-9003`

## Panel walkthrough (by portal)
1. **Login** — network snapshot KPIs (no private names)
2. **Manager** — Morning Brief → KPI ribbon → map → Warnings → Approvals (detention on `LD-2012-ACC`) → Profitability heatmap
3. **Broker** — task board, unassigned `LD-2014-OPEN`, carrier scorecards / insurance warnings
4. **Billing** — Ready to bill / AR aging / collections note on overdue / dispute `INV-9003`
5. **Shipper** (`customer@`) — delayed Midwest load, invoices only (no COGS)
6. **Carrier** (`carrier@`) — assigned loads + missing-POD task on `LD-2021-NOPOD`

Classic C2C path still works: broker creates load → carrier POD → billing invoices → payment → manager margin.

## Smoke test
With the app running locally:
```bash
npm run smoke
```
Optional: `SMOKE_BASE_URL=http://localhost:3001 npm run smoke` if your dev server is not on 3000.

## Branch
Work on your personal branch (e.g. `SylviaHowell`), not directly on `main`.
