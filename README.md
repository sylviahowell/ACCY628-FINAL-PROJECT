# FreightFlow

Freight Brokerage & Logistics contract-to-cash app for ACCY628.

## Stack
Next.js · React · Tailwind CSS · daisyUI · Supabase · Recharts

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

| Email | Role |
|-------|------|
| manager@freightflow.example | Manager |
| broker@freightflow.example | Broker |
| customer@freightflow.example | Customer |
| carrier@freightflow.example | Carrier |

If login fails with an email confirmation error: Supabase Dashboard → Authentication → Providers → Email → turn off **Confirm email**.

## Test the main workflow
1. Login as **broker** → create/view customer, carrier, contract
2. Create a **shipment** with sell rate and buy cost
3. Login as **carrier** → confirm pickup → in transit → upload POD / deliver
4. Login as **broker/manager** → generate invoice
5. Record a **payment** → invoice balance updates
6. Open **Profitability** / **Dashboard** charts
7. Login as **customer** → track shipments, view invoices, submit dispute

## Branch
Work on your personal branch (e.g. `SylviaHowell`), not directly on `main`.
