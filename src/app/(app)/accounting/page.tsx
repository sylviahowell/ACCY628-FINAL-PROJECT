import Link from "next/link";
import { AccountingEntriesPanel } from "@/components/AccountingEntriesPanel";
import { ChartOfAccountsPanel } from "@/components/ChartOfAccountsPanel";
import { ExpandableSection } from "@/components/ExpandableSection";
import { resolveSearchParams } from "@/components/FilterBanner";
import {
  buildAccountingEntries,
  type AccountingEntryType,
} from "@/lib/accounting-entries";
import { rollupAccountActivity } from "@/lib/chart-of-accounts";
import { isActiveFinalInvoice } from "@/lib/invoice-helpers";
import { requireRoles } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";

const ENTRY_FILTERS = new Set<AccountingEntryType>([
  "recognize",
  "bill",
  "collect",
  "write_off",
  "accrue_ap",
  "pay_carrier",
]);

/**
 * GAAP-oriented workspace for freight brokerage (ASC 606-style performance obligations).
 * Revenue is treated as earned when the load is delivered with POD evidence;
 * billing may lag (contract asset / unbilled earned) or AR may sit unpaid.
 */
export default async function AccountingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  await requireRoles(["manager", "billing"]);
  const params = await resolveSearchParams(searchParams);
  const entriesFilter = ENTRY_FILTERS.has(params.entries as AccountingEntryType)
    ? (params.entries as AccountingEntryType)
    : "all";

  const supabase = await createClient();

  const { data: shipments } = await supabase
    .from("shipments")
    .select(
      "id, load_number, status, customer_rate, carrier_cost, carrier_id, discount_amount, discount_approved, delivery_date, customers(name)",
    );
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, shipment_id, invoice_number, status, total, amount_paid, issue_date, due_date, customers(name)");
  const { data: charges } = await supabase
    .from("shipment_charges")
    .select("shipment_id, amount, billable_to_customer, payable_to_carrier, approval_status, charge_type");
  const { data: pods } = await supabase
    .from("proof_of_delivery")
    .select("shipment_id, delivered_at");
  const { data: payments } = await supabase
    .from("payments")
    .select("id, invoice_id, amount, payment_date, method, invoices(invoice_number, shipment_id, customers(name))");
  const { data: carrierBills } = await supabase
    .from("carrier_bills")
    .select(
      "id, bill_number, status, total, amount_paid, issue_date, due_date, shipment_id, carriers(name), shipments(load_number)",
    );
  const { data: carrierPayments } = await supabase
    .from("carrier_payments")
    .select(
      "id, carrier_bill_id, amount, payment_date, carrier_bills(bill_number, shipment_id, shipments(load_number))",
    );

  const journalEntries = buildAccountingEntries({
    shipments: (shipments ?? []).map((s) => ({
      ...s,
      customers: (Array.isArray(s.customers) ? s.customers[0] : s.customers) as {
        name?: string;
      } | null,
    })),
    charges: charges ?? [],
    pods: pods ?? [],
    invoices: (invoices ?? []).map((i) => ({
      ...i,
      customers: (Array.isArray(i.customers) ? i.customers[0] : i.customers) as {
        name?: string;
      } | null,
    })),
    payments: (payments ?? []).map((p) => {
      const inv = (Array.isArray(p.invoices) ? p.invoices[0] : p.invoices) as {
        invoice_number?: string;
        shipment_id?: string | null;
        customers?: { name?: string } | { name?: string }[] | null;
      } | null;
      const cust = inv?.customers
        ? Array.isArray(inv.customers)
          ? inv.customers[0]
          : inv.customers
        : null;
      return {
        id: p.id,
        invoice_id: p.invoice_id,
        amount: p.amount,
        payment_date: p.payment_date,
        method: p.method,
        invoices: inv
          ? {
              invoice_number: inv.invoice_number,
              shipment_id: inv.shipment_id,
              customers: cust,
            }
          : null,
      };
    }),
    carrierBills: (carrierBills ?? []).map((b) => ({
      ...b,
      carriers: (Array.isArray(b.carriers) ? b.carriers[0] : b.carriers) as {
        name?: string;
      } | null,
      shipments: (Array.isArray(b.shipments) ? b.shipments[0] : b.shipments) as {
        load_number?: string;
      } | null,
    })),
    carrierPayments: (carrierPayments ?? []).map((p) => {
      const bill = (Array.isArray(p.carrier_bills)
        ? p.carrier_bills[0]
        : p.carrier_bills) as {
        bill_number?: string;
        shipment_id?: string;
        shipments?: { load_number?: string } | { load_number?: string }[] | null;
      } | null;
      const ship = bill?.shipments
        ? Array.isArray(bill.shipments)
          ? bill.shipments[0]
          : bill.shipments
        : null;
      return {
        id: p.id,
        carrier_bill_id: p.carrier_bill_id,
        amount: p.amount,
        payment_date: p.payment_date,
        carrier_bills: bill
          ? {
              bill_number: bill.bill_number,
              shipment_id: bill.shipment_id,
              shipments: ship,
            }
          : null,
      };
    }),
  });

  const billedShipmentIds = new Set(
    (invoices ?? [])
      .filter((i) => isActiveFinalInvoice(i) && i.shipment_id)
      .map((i) => i.shipment_id as string),
  );
  const podShipments = new Set((pods ?? []).map((p) => p.shipment_id));

  const billableExtras = (shipmentId: string) =>
    (charges ?? [])
      .filter(
        (c) =>
          c.shipment_id === shipmentId &&
          c.billable_to_customer &&
          c.approval_status === "approved",
      )
      .reduce((s, c) => s + Number(c.amount), 0);

  const payableExtras = (shipmentId: string) =>
    (charges ?? [])
      .filter(
        (c) =>
          c.shipment_id === shipmentId &&
          c.payable_to_carrier &&
          c.approval_status === "approved",
      )
      .reduce((s, c) => s + Number(c.amount), 0);

  // Earned = performance complete (delivered/completed + POD when required)
  const earnedUnbilled = (shipments ?? []).filter(
    (s) =>
      ["delivered", "completed"].includes(s.status) &&
      podShipments.has(s.id) &&
      !billedShipmentIds.has(s.id),
  );

  const earnedUnbilledAmount = earnedUnbilled.reduce((sum, s) => {
    const discount = s.discount_approved ? Number(s.discount_amount || 0) : 0;
    return sum + Number(s.customer_rate) - discount + billableExtras(s.id);
  }, 0);

  const inProgress = (shipments ?? []).filter((s) =>
    ["scheduled", "assigned", "booked", "picked_up", "in_transit"].includes(s.status),
  );
  const deferredPipeline = inProgress.reduce(
    (sum, s) => sum + Number(s.customer_rate),
    0,
  );

  const openAr = (invoices ?? []).reduce((sum, i) => {
    if (["paid", "cancelled"].includes(i.status)) return sum;
    return sum + Math.max(0, Number(i.total) - Number(i.amount_paid));
  }, 0);

  const cashCollected = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const billedTotal = (invoices ?? [])
    .filter((i) => i.status !== "cancelled")
    .reduce((s, i) => s + Number(i.total), 0);

  const openAp = (carrierBills ?? []).reduce((sum, b) => {
    if (["paid", "cancelled"].includes(b.status)) return sum;
    return sum + Math.max(0, Number(b.total) - Number(b.amount_paid));
  }, 0);

  const accruedUnbilledPayables = (shipments ?? []).filter(
    (s) =>
      ["delivered", "completed"].includes(s.status) &&
      podShipments.has(s.id) &&
      s.carrier_id &&
      !(carrierBills ?? []).some(
        (b) => b.shipment_id === s.id && b.status !== "cancelled",
      ),
  );
  const accruedUnbilledPayableAmount = accruedUnbilledPayables.reduce(
    (sum, s) => sum + Number(s.carrier_cost) + payableExtras(s.id),
    0,
  );

  const cogsOnEarned = earnedUnbilled.reduce(
    (sum, s) => sum + Number(s.carrier_cost) + payableExtras(s.id),
    0,
  );

  const openReceivables = (invoices ?? []).filter((i) => {
    const bal = Number(i.total) - Number(i.amount_paid);
    return bal > 0 && i.status !== "cancelled";
  });
  const openPayables = (carrierBills ?? []).filter((b) => {
    const bal = Number(b.total) - Number(b.amount_paid);
    return bal > 0 && b.status !== "cancelled";
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounting</h1>
        <p className="text-sm opacity-70">
          Snapshot KPIs stay visible — expand a section below for ledgers, schedules, and
          policy detail.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link href="#chart-of-accounts" className="link link-primary">
            Chart of accounts
          </Link>
          <Link href="#accounting-entries" className="link link-primary">
            Accounting entries
          </Link>
          <Link href="#earned-unbilled" className="link link-hover opacity-70">
            Earned unbilled
          </Link>
          <Link href="#open-receivables" className="link link-hover opacity-70">
            Receivables
          </Link>
          <Link href="#open-payables" className="link link-hover opacity-70">
            Payables
          </Link>
        </div>
      </div>

      <ExpandableSection
        title="Revenue recognition policy"
        description="ASC 606–aligned rules for when RowanLane earns freight brokerage revenue."
        defaultOpen={false}
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            <b>Contract identified</b> — customer agreement (contract or spot booking) with sell
            rate and payment terms.
          </li>
          <li>
            <b>Performance obligation</b> — arrange and complete the freight move (pickup →
            delivery).
          </li>
          <li>
            <b>Transaction price</b> — customer rate − approved discounts + approved billable
            accessorials / fuel surcharge.
          </li>
          <li>
            <b>Allocate</b> — one obligation per load (brokerage service for that shipment).
          </li>
          <li>
            <b>Recognize when satisfied</b> — when the load is <b>delivered</b> and{" "}
            <b>proof of delivery</b> exists. Cash collection and invoice timing do not change when
            revenue is earned.
          </li>
        </ol>
        <div className="rounded-box bg-base-200 p-3 text-sm">
          <p className="font-medium">How this app enforces the policy</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 opacity-80">
            <li>Invoices cannot be generated for cancelled loads.</li>
            <li>POD is required before invoicing (and before marking completed).</li>
            <li>Disputed invoices block final cash application until resolved.</li>
            <li>
              Accessorial / discount changes need approval before they enter the billable price.
            </li>
            <li>
              Deposits/retainers are not used in this brokerage model (nothing to defer as
              unearned cash).
            </li>
          </ul>
        </div>
      </ExpandableSection>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Earned, not yet billed</div>
            <div className="stat-value text-xl text-warning">{money(earnedUnbilledAmount)}</div>
            <div className="stat-desc">{earnedUnbilled.length} delivered loads awaiting invoice</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Accounts receivable</div>
            <div className="stat-value text-xl">{money(openAr)}</div>
            <div className="stat-desc">Billed, unpaid balances</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Cash collected</div>
            <div className="stat-value text-xl text-success">{money(cashCollected)}</div>
            <div className="stat-desc">Against {money(billedTotal)} billed</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">In-progress pipeline</div>
            <div className="stat-value text-xl">{money(deferredPipeline)}</div>
            <div className="stat-desc">Not earned yet ({inProgress.length} active loads)</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Accounts payable</div>
            <div className="stat-value text-xl">{money(openAp)}</div>
            <div className="stat-desc">Open carrier bills unpaid</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Accrued, not yet billed to carrier</div>
            <div className="stat-value text-xl text-warning">
              {money(accruedUnbilledPayableAmount)}
            </div>
            <div className="stat-desc">
              {accruedUnbilledPayables.length} delivered loads awaiting carrier bill
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ExpandableSection
          id="earned-unbilled"
          title="Contract asset — earned unbilled"
          description={`Performance complete; invoice not yet issued. Related carrier cost still sits as estimated COGS: ${money(cogsOnEarned)}.`}
          badge={`${earnedUnbilled.length} load${earnedUnbilled.length === 1 ? "" : "s"}`}
          defaultOpen={earnedUnbilled.length > 0 && earnedUnbilled.length <= 5}
        >
          <div className="overflow-x-auto pb-2">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Load</th>
                  <th>Customer</th>
                  <th>Earned amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {earnedUnbilled.map((s) => {
                  const discount = s.discount_approved ? Number(s.discount_amount || 0) : 0;
                  const amt = Number(s.customer_rate) - discount + billableExtras(s.id);
                  return (
                    <tr key={s.id}>
                      <td>{s.load_number}</td>
                      <td>{(s.customers as { name?: string } | null)?.name}</td>
                      <td>{money(amt)}</td>
                      <td>
                        <Link href="/invoices" className="link link-primary text-xs">
                          Ready to bill
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {earnedUnbilled.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="opacity-60">
                      No unbilled earned loads right now.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </ExpandableSection>

        <ExpandableSection
          id="open-receivables"
          title="Open receivables (billed)"
          description="Revenue already earned and billed; cash not yet fully collected."
          badge={`${openReceivables.length} open`}
          defaultOpen={false}
        >
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {openReceivables.slice(0, 12).map((i) => (
                  <tr key={i.id}>
                    <td>{i.invoice_number}</td>
                    <td>
                      <span className={`badge badge-sm ${statusBadge(i.status)}`}>
                        {i.status}
                      </span>
                    </td>
                    <td>{money(Number(i.total) - Number(i.amount_paid))}</td>
                    <td>{i.due_date}</td>
                  </tr>
                ))}
                {openReceivables.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="opacity-60">
                      No open receivables right now.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Link href="/ar" className="btn btn-ghost btn-sm w-fit">
            Full AR aging →
          </Link>
        </ExpandableSection>
      </div>

      <ExpandableSection
        id="open-payables"
        title="Open payables (carrier bills)"
        description="Carrier buy cost recognized with delivery; cash not yet fully remitted."
        badge={`${openPayables.length} open`}
        defaultOpen={false}
      >
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Load</th>
                <th>Carrier</th>
                <th>Status</th>
                <th>Balance</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {openPayables.slice(0, 12).map((b) => (
                <tr key={b.id}>
                  <td>{b.bill_number}</td>
                  <td>
                    {(b.shipments as { load_number?: string } | null)?.load_number ?? "—"}
                  </td>
                  <td>{(b.carriers as { name?: string } | null)?.name ?? "—"}</td>
                  <td>
                    <span className={`badge badge-sm ${statusBadge(b.status)}`}>
                      {b.status}
                    </span>
                  </td>
                  <td>{money(Number(b.total) - Number(b.amount_paid))}</td>
                  <td>{b.due_date}</td>
                </tr>
              ))}
              {openPayables.length === 0 ? (
                <tr>
                  <td colSpan={6} className="opacity-60">
                    No open carrier payables right now.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Link href="/ap" className="btn btn-ghost btn-sm w-fit">
          Full AP workspace →
        </Link>
      </ExpandableSection>

      <ChartOfAccountsPanel
        activity={rollupAccountActivity(journalEntries.flatMap((e) => e.lines))}
      />

      <AccountingEntriesPanel entries={journalEntries} activeFilter={entriesFilter} />

      <ExpandableSection
        title="Cost classification (brokerage)"
        description="How carrier costs map to COGS vs pass-through revenue on each load."
        defaultOpen={false}
      >
        <p className="text-sm opacity-80">
          Direct costs tied to each shipment support customer and load profitability:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            <b>Carrier buy cost</b> — purchased transportation (primary COGS).
          </li>
          <li>
            <b>Payable accessorials</b> — detention, layover, etc. owed to the carrier.
          </li>
          <li>
            <b>Billable accessorials / fuel</b> — passed to the customer (increase revenue, not
            COGS).
          </li>
        </ul>
        <p className="text-sm opacity-70">
          Labor, materials, and overhead are outside this brokerage operating model; margin is
          measured as customer revenue − carrier-related costs per load.
        </p>
        <Link href="/profitability" className="link link-primary w-fit">
          Open profitability analysis
        </Link>
      </ExpandableSection>
    </div>
  );
}
