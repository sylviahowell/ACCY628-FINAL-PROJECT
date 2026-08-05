# RowanLane internal controls

Product controls that protect booking, billing, and cash application. For ACCY628, these map loosely to the five classic control components (environment, risk assessment, activities, information & communication, monitoring)—without putting that branding on UI screens.

## Five components → live product behavior

| Component ideal | Neutral product labeling / behavior | Where it shows up |
|-----------------|-------------------------------------|-------------------|
| Control environment | Role portals, Settings “System control policies”, manager-only Approvals threshold | Login portals · Settings · `roles.ts` |
| Risk assessment | Risk & Credit, Warnings, carrier scorecards, credit utilization | `/risk` · `/warnings` · Carriers · Morning Brief |
| Control activities | Hard stops in server actions (POD, credit, insurance, disputes, approvals) | `freight.ts` mutations · shipment/create forms |
| Information & communication | Status history, Control overrides callout, notification prefs (device-local demo) | Shipment detail · Settings · toasts |
| Monitoring | Approvals inbox, Control activity log, AR collections notes, profitability loss flags | `/approvals` · `/controls` · `/ar` · `/profitability` |

## Segregation of duties (SoD) matrix

| Activity | Broker Ops | Billing | Manager | Shipper | Carrier |
|----------|:----------:|:-------:|:-------:|:-------:|:-------:|
| Book / create shipment | ✓ | — | ✓ | — | — |
| Assign carrier | ✓ | — | ✓ | — | — |
| Upload POD / advance ops status | ✓ (ops) | — | ✓ | — | ✓ (assigned) |
| Generate invoice | — | ✓ | ✓ | — | — |
| Record payment | — | ✓ | ✓ | — | — |
| Approve discounts / accessorials | — | — | ✓ | — | — |
| Open dispute | — | — | — | ✓ | — |
| Resolve dispute | — | ✓ | ✓ | — | — |
| View Control activity | — | — | ✓ | — | — |

**Honesty note:** Managers may perform ops + billing + approve. That is a demo SoD weakness. Compensating controls are **logged overrides** (credit), **Approval Inbox**, **Risk & Credit**, and the **Control activity** log—not dual-approver workflows.

## Fraud / residual risk register

| Risk | Control | Residual gap |
|------|---------|--------------|
| Booking over credit | Brokers blocked; managers may override with logged note | Manager self-override without second person |
| Expired carrier insurance | Hard-block on assign/create; Suspended carriers hidden from assign pickers | Certificate data is demo-entered, not verified with insurer |
| Unbilled delivered freight | Ready-to-bill queues + POD gate | Timing depends on operator follow-through |
| False revenue (invoice without evidence) | POD required before invoice/complete; cancelled blocked | Demo POD URL can be attached without real file upload |
| Paying a disputed invoice | `recordPayment` blocked while status is disputed | Billing can still resolve dispute then pay |
| Unauthorized discount / accessorial | Pending approval for brokers above threshold | Managers auto-approve their own entries |
| Negative-margin loads | Brokers blocked at book/assign when carrier cost exceeds customer rate; manager override logged | Manager self-override without second person |
| Shared demo credentials | Env-gated demo portals + rate limits | Acceptable for pitch; not production IdP |

## Closed-loop demo script

Use `manager@rowanlane.example` unless noted. Password: `FreightDemo2026!`.

1. **Morning Brief** (`/dashboard`) — Note credit watch, insurance expiring/expired, delayed loads, pending approvals.
2. **Warnings** (`/warnings`) — Triage delayed / needs coverage / insurance / approval items; open a shipment from a chip.
3. **Approvals** (`/approvals`) — Approve or reject pending accessorial/discount (e.g. detention on `LD-2012-ACC`). Reject requires a comment.
4. **Risk & Credit** (`/risk`) — Customer utilization (Summit/Midwest) and carrier insurance (expired Midwest Reefer = Suspended / blocked).
5. **Control activity** (`/controls`) — Confirm recent approvals, credit override notes, and collection notes appear with links.
6. **AR** (`/ar`) — Overdue worklist, collection note on `INV-EDGE-OVERDUE`, dispute awareness for `INV-9003`.
7. **Optional broker path** — As broker, try booking above credit (blocked), a loss load where carrier cost exceeds customer rate (blocked), or assigning an expired-insurance carrier (blocked). As manager, credit/margin overrides book and log on the shipment **Control overrides** callout.

## Related docs

- [DEPENDABILITY.md](./DEPENDABILITY.md) — security, RLS, observability framing
- [README.md](../README.md) — runbook and portal walkthrough
