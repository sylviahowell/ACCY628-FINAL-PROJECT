# LaneLedger Freight — ACCY628 Final Project

Web-based **freight brokerage** contract engagement and contract-to-cash system.

## Shared infrastructure (use these only)

| Resource | Value |
|----------|--------|
| GitHub | `sylviahowell/ACCY628-FINAL-PROJECT` |
| Supabase project | **ACCY628-Final-Project** (`hdoaultadiqdmaijcjyp`) |
| Do not use | ConcertCosts or any other Supabase project |

## Local setup

1. Clone the repo and open it in Cursor.
2. Create `.env.local` (never commit this):

```env
NEXT_PUBLIC_SUPABASE_URL=https://hdoaultadiqdmaijcjyp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key from Supabase>
```

3. Install and run:

```bash
npm install
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) and use the **demo role picker** on `/login`.

### Demo accounts

Password for all: `FreightDemo2026!`

| Email | Role |
|-------|------|
| manager@freight.demo | Manager |
| broker@freight.demo | Broker |
| billing@freight.demo | Billing |
| customer@freight.demo | Customer (Midwest Retail) |
| carrier@freight.demo | Carrier (Prairie Haulers) |

If first login fails with an email-confirmation error, in Supabase Dashboard → Authentication → Providers → Email, turn off **Confirm email** for development/demo.

## Branch workflow

- Work on your **own branch** (not `main`).
- Pull latest `main` before starting new work.
- Do not commit `.env.local`.

### Ready for team review / merge (section 6.8)

This foundation lives on branch **`SylviaHowell`** and is not yet committed/pushed. When the team agrees:

1. Commit on `SylviaHowell` (exclude `.env.local`).
2. Push the branch: `git push -u origin SylviaHowell`
3. Ask Cursor to merge into `main` **locally** after pulling latest `main`, test with `npm run dev`, then push `main`.
4. Teammates pull `main` into their own branches (section 6.9).

Do **not** merge to `main` until at least one teammate has reviewed the spine flow (login → load → POD → invoice → payment).

## What this foundation includes

- Roles with different workspaces (manager, broker, billing, customer, carrier)
- Customers, carriers, contracts, shipments/loads
- Accessorial charges, invoices, simulated payments, disputes
- Delivery confirmation (POD) before invoicing
- Brokerage margin view (`shipment_profitability`)
- Status audit trail

## Team next modules

Broker ops polish, carrier POD UX, customer portal depth, AR aging dashboards, GAAP/controls documentation in-app, richer seed edge cases, Vercel deploy (owner only).
