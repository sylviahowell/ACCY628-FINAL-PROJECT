import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/EmptyState";
import { FocusScroll } from "@/components/FocusScroll";
import { StatusPie } from "@/components/Charts";
import {
  generateCarrierBill,
  recordCarrierPayment,
} from "@/lib/actions/freight";
import { requireRoles } from "@/lib/authz";
import { agingChartData } from "@/lib/collections";
import {
  buildPayableWorklist,
  buildReadyToPayQueue,
  computePayableAging,
  openApBalance,
} from "@/lib/payables";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";

export default async function AccountsPayablePage() {
  await requireRoles(["manager", "billing"]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: bills },
    { data: payments },
    { data: shipments },
    { data: pods },
    { data: charges },
  ] = await Promise.all([
    supabase
      .from("carrier_bills")
      .select("*, carriers(name), shipments(load_number)")
      .order("due_date"),
    supabase
      .from("carrier_payments")
      .select(
        "*, carrier_bills(bill_number, total, amount_paid, status, carriers(name))",
      )
      .order("payment_date", { ascending: false }),
    supabase
      .from("shipments")
      .select(
        "id, load_number, status, carrier_id, carrier_cost, delivery_date, carriers(name)",
      )
      .in("status", ["delivered", "completed"]),
    supabase.from("proof_of_delivery").select("shipment_id"),
    supabase
      .from("shipment_charges")
      .select("shipment_id, amount, payable_to_carrier, approval_status"),
  ]);

  const billList = bills ?? [];
  const aging = computePayableAging(billList, today);
  const totalAp = openApBalance(billList);
  const overdueAp =
    aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90_plus;

  const billedIds = new Set(
    billList
      .filter((b) => b.status !== "cancelled")
      .map((b) => b.shipment_id as string),
  );
  const podIds = new Set((pods ?? []).map((p) => p.shipment_id as string));
  const chargesByShipment = new Map<
    string,
    { amount: number; payable_to_carrier?: boolean; approval_status?: string | null }[]
  >();
  for (const c of charges ?? []) {
    const list = chargesByShipment.get(c.shipment_id) ?? [];
    list.push(c);
    chargesByShipment.set(c.shipment_id, list);
  }

  const ready = buildReadyToPayQueue({
    shipments: (shipments ?? []).map((s) => ({
      id: s.id,
      load_number: s.load_number,
      status: s.status,
      carrier_id: s.carrier_id,
      carrier_cost: Number(s.carrier_cost),
      delivery_date: s.delivery_date,
      carriers: s.carriers as { name?: string } | null,
    })),
    billedShipmentIds: billedIds,
    podShipmentIds: podIds,
    chargesByShipment,
  });

  const worklist = buildPayableWorklist({
    bills: billList.map((b) => ({
      id: b.id,
      bill_number: b.bill_number,
      carrier_id: b.carrier_id,
      shipment_id: b.shipment_id,
      total: Number(b.total),
      amount_paid: Number(b.amount_paid),
      due_date: b.due_date,
      status: b.status,
      carriers: b.carriers as { name?: string } | null,
      shipments: b.shipments as { load_number?: string } | null,
    })),
    today,
  });

  const openBills = billList.filter((b) => {
    const bal = Number(b.total) - Number(b.amount_paid);
    return bal > 0 && !["cancelled", "paid"].includes(b.status);
  });

  const agingChart = agingChartData(aging);

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>
      <div>
        <h1 className="text-2xl font-bold">Accounts Payable</h1>
        <p className="text-sm opacity-70">
          Carrier bills, aging, and outbound payments — the pay side of contract-to-cash.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Total AP</div>
            <div className="stat-value text-xl">{money(totalAp)}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Current</div>
            <div className="stat-value text-xl">{money(aging.current)}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Past due</div>
            <div
              className={`stat-value text-xl ${overdueAp > 0 ? "text-warning" : ""}`}
            >
              {money(overdueAp)}
            </div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Ready to bill</div>
            <div className="stat-value text-xl">{ready.length}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Open bills</div>
            <div className="stat-value text-xl">{openBills.length}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Payments logged</div>
            <div className="stat-value text-xl">{(payments ?? []).length}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">AP aging</h2>
            <StatusPie data={agingChart} />
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Record carrier payment</h2>
            <form action={recordCarrierPayment} className="grid gap-3">
              <select
                name="carrier_bill_id"
                required
                className="select select-bordered w-full"
              >
                <option value="">Open carrier bill…</option>
                {openBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bill_number} ·{" "}
                    {(b.carriers as { name?: string } | null)?.name} · bal{" "}
                    {money(Number(b.total) - Number(b.amount_paid))}
                  </option>
                ))}
              </select>
              <input
                name="payment_date"
                type="date"
                defaultValue={today}
                className="input input-bordered"
              />
              <input
                name="amount"
                type="number"
                step="0.01"
                required
                placeholder="Amount"
                className="input input-bordered"
              />
              <select name="method" className="select select-bordered">
                <option value="ach_simulated">ACH</option>
                <option value="wire_simulated">Wire</option>
                <option value="check_simulated">Check</option>
              </select>
              <input
                name="reference"
                placeholder="Reference #"
                className="input input-bordered"
              />
              <button className="btn btn-primary">Save carrier payment</button>
            </form>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">
            Ready to create carrier bills{" "}
            <span className="badge badge-ghost badge-sm">{ready.length}</span>
          </h2>
          {ready.length === 0 ? (
            <p className="text-sm opacity-70">
              No delivered+POD loads waiting for a carrier bill.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Load</th>
                    <th>Carrier</th>
                    <th>Delivered</th>
                    <th>Est. payable</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ready.map((r) => (
                    <tr key={r.shipmentId}>
                      <td>
                        <Link
                          href={`/shipments/${r.shipmentId}`}
                          className="link link-primary"
                        >
                          {r.loadNumber}
                        </Link>
                      </td>
                      <td>{r.carrierName}</td>
                      <td>{r.deliveryDate ?? "—"}</td>
                      <td>{money(r.estimatedPayable)}</td>
                      <td>
                        <form action={generateCarrierBill.bind(null, r.shipmentId)}>
                          <button className="btn btn-outline btn-xs">
                            Create bill
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Payables worklist</h2>
          {worklist.length === 0 ? (
            <EmptyState
              title="No open payables"
              description="Create carrier bills for delivered loads, then record payments here."
            />
          ) : (
            <ul className="divide-y divide-base-200">
              {worklist.map((item) => (
                <li
                  key={item.billId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {item.billNumber} · {item.loadNumber} · {item.carrierName}
                    </p>
                    <p className="text-sm opacity-70">
                      Balance {money(item.balance)} · due {item.dueDate}
                      {item.daysOutstanding > 0
                        ? ` · ${item.daysOutstanding}d past due`
                        : ""}
                    </p>
                    <p className="text-sm">{item.recommendedAction}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge badge-sm ${
                        item.priority === "high"
                          ? "badge-error"
                          : item.priority === "medium"
                            ? "badge-warning"
                            : "badge-ghost"
                      }`}
                    >
                      {item.priority}
                    </span>
                    <Link
                      href={`/shipments/${item.shipmentId}`}
                      className="btn btn-ghost btn-xs"
                    >
                      Load
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">All carrier bills</h2>
          {billList.length === 0 ? (
            <p className="text-sm opacity-70">No carrier bills yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Load</th>
                    <th>Carrier</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {billList.map((b) => {
                    const bal = Number(b.total) - Number(b.amount_paid);
                    return (
                      <tr key={b.id}>
                        <td>{b.bill_number}</td>
                        <td>
                          {(b.shipments as { load_number?: string } | null)
                            ?.load_number ?? "—"}
                        </td>
                        <td>
                          {(b.carriers as { name?: string } | null)?.name ?? "—"}
                        </td>
                        <td>
                          <span className={`badge badge-sm ${statusBadge(b.status)}`}>
                            {b.status}
                          </span>
                        </td>
                        <td>{money(b.total)}</td>
                        <td>{money(b.amount_paid)}</td>
                        <td>{money(bal)}</td>
                        <td>{b.due_date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Recent carrier payments</h2>
          {(payments ?? []).length === 0 ? (
            <p className="text-sm opacity-70">No outbound payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bill</th>
                    <th>Carrier</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {(payments ?? []).slice(0, 20).map((p) => {
                    const bill = p.carrier_bills as {
                      bill_number?: string;
                      carriers?: { name?: string } | null;
                    } | null;
                    return (
                      <tr key={p.id}>
                        <td>{p.payment_date}</td>
                        <td>{bill?.bill_number ?? "—"}</td>
                        <td>{bill?.carriers?.name ?? "—"}</td>
                        <td>{money(p.amount)}</td>
                        <td>{String(p.method || "").replace(/_simulated$/i, "")}</td>
                        <td>{p.reference ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
