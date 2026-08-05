import Link from "next/link";
import { requireRoles } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";

/**
 * GAAP-oriented workspace for freight brokerage (ASC 606-style performance obligations).
 * Revenue is treated as earned when the load is delivered with POD evidence;
 * billing may lag (contract asset / unbilled earned) or AR may sit unpaid.
 */
export default async function AccountingPage() {
  await requireRoles(["manager", "billing"]);
  const supabase = await createClient();

  const { data: shipments } = await supabase
    .from("shipments")
    .select(
      "id, load_number, status, customer_rate, carrier_cost, discount_amount, discount_approved, delivery_date, customers(name)",
    );
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, shipment_id, invoice_number, status, total, amount_paid, issue_date, due_date, customers(name)");
  const { data: charges } = await supabase
    .from("shipment_charges")
    .select("shipment_id, amount, billable_to_customer, payable_to_carrier, approval_status, charge_type");
  const { data: pods } = await supabase.from("proof_of_delivery").select("shipment_id");
  const { data: payments } = await supabase.from("payments").select("amount, payment_date");

  const billedShipmentIds = new Set(
    (invoices ?? [])
      .filter((i) => i.status !== "cancelled" && i.shipment_id)
      .map((i) => i.shipment_id as string),
  );
  const podShipments = new Set((pods ?? []).map((p) => p.shipment_id as string));

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

  const cogsOnEarned = earnedUnbilled.reduce(
    (sum, s) => sum + Number(s.carrier_cost) + payableExtras(s.id),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounting</h1>
        <p className="text-sm opacity-70">
          Revenue earned at delivery with POD, open AR, and cash collected — in one workspace.
        </p>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 text-sm">
          <details className="collapse collapse-arrow rounded-box border border-base-300 bg-base-200/40">
            <summary className="collapse-title min-h-0 py-3 font-medium">
              Revenue recognition policy (ASC 606–aligned)
            </summary>
            <div className="collapse-content space-y-3">
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  <b>Contract identified</b> — customer agreement (contract or spot booking) with sell rate
                  and payment terms.
                </li>
                <li>
                  <b>Performance obligation</b> — arrange and complete the freight move (pickup → delivery).
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
              <div className="rounded-box bg-base-200 p-3">
                <p className="font-medium">How this app enforces the policy</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 opacity-80">
                  <li>Invoices cannot be generated for cancelled loads.</li>
                  <li>POD is required before invoicing (and before marking completed).</li>
                  <li>Disputed invoices block final cash application until resolved.</li>
                  <li>Accessorial / discount changes need approval before they enter the billable price.</li>
                  <li>Deposits/retainers are not used in this brokerage model (nothing to defer as unearned cash).</li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Contract asset — earned unbilled</h2>
            <p className="text-sm opacity-70">
              Performance complete; invoice not yet issued. Related carrier cost still sits as
              estimated COGS: {money(cogsOnEarned)}.
            </p>
            <div className="overflow-x-auto">
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
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Open receivables (billed)</h2>
            <p className="text-sm opacity-70">
              Revenue already earned and billed; cash not yet fully collected.
            </p>
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
                  {(invoices ?? [])
                    .filter((i) => {
                      const bal = Number(i.total) - Number(i.amount_paid);
                      return bal > 0 && i.status !== "cancelled";
                    })
                    .slice(0, 12)
                    .map((i) => (
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
                </tbody>
              </table>
            </div>
            <Link href="/ar" className="btn btn-ghost btn-sm w-fit">
              Full AR aging →
            </Link>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body text-sm">
          <h2 className="card-title text-base">Cost classification (brokerage)</h2>
          <p className="opacity-80">
            Direct costs tied to each shipment support customer and load profitability:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b>Carrier buy cost</b> — purchased transportation (primary COGS).
            </li>
            <li>
              <b>Payable accessorials</b> — detention, layover, etc. owed to the carrier.
            </li>
            <li>
              <b>Billable accessorials / fuel</b> — passed to the customer (increase revenue, not COGS).
            </li>
          </ul>
          <p className="mt-2 opacity-70">
            Labor, materials, and overhead are outside this brokerage operating model; margin is
            measured as customer revenue − carrier-related costs per load.
          </p>
          <Link href="/profitability" className="link link-primary mt-2 w-fit">
            Open profitability analysis
          </Link>
        </div>
      </div>
    </div>
  );
}
