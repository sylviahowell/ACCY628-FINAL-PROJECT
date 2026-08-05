import Link from "next/link";
import { BookCoverageForm } from "@/components/BookCoverageForm";
import { requirePathAccess } from "@/lib/authz";
import {
  acceptCoverageRequest,
  cancelCoverageRequest,
  createCoverageRequest,
  declineCoverageRequest,
} from "@/lib/actions/coverage";
import {
  isOnCreditHold,
  pastDueBalanceFromInvoices,
} from "@/lib/credit-hold";
import { createClient } from "@/lib/supabase/server";
import { isOperations } from "@/lib/types";

function statusBadge(status: string) {
  if (status === "pending") return "badge-warning";
  if (status === "accepted") return "badge-success";
  if (status === "declined") return "badge-error";
  return "badge-ghost";
}

export default async function CoveragePage() {
  const profile = await requirePathAccess("/coverage");
  const supabase = await createClient();
  const isCustomer = profile.role === "customer";
  const isOps = isOperations(profile.role);

  let query = supabase
    .from("coverage_requests")
    .select(
      "id, status, pickup_location, delivery_location, pickup_date, delivery_date, freight_type, weight_lbs, notes, shipment_id, created_at, customer_id, customers(name), shipments(load_number)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (isCustomer && profile.customer_id) {
    query = query.eq("customer_id", profile.customer_id);
  } else if (!isOps) {
    return (
      <div className="alert alert-warning">
        <span>Coverage requests are managed by shippers and Broker Operations.</span>
      </div>
    );
  }

  const { data: rows } = await query;
  const pending = (rows ?? []).filter((r) => r.status === "pending");

  const { data: contracts } = isOps
    ? await supabase
        .from("contracts")
        .select(
          "id, contract_number, title, customer_id, status, downpayment_pct, customer_rate_per_mile, carrier_rate_per_mile",
        )
        .eq("status", "active")
        .order("contract_number")
    : { data: [] as never[] };

  const pendingCustomerIds = [
    ...new Set(pending.map((r) => r.customer_id).filter(Boolean)),
  ] as string[];
  const pastDueByCustomer = new Map<string, number>();
  if (isOps && pendingCustomerIds.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: invoices } = await supabase
      .from("invoices")
      .select("customer_id, total, amount_paid, status, due_date")
      .in("customer_id", pendingCustomerIds)
      .neq("status", "cancelled");
    for (const customerId of pendingCustomerIds) {
      const invs = (invoices ?? []).filter((i) => i.customer_id === customerId);
      pastDueByCustomer.set(customerId, pastDueBalanceFromInvoices(invs, today));
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isCustomer ? "Request coverage" : "Coverage requests"}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          {isCustomer
            ? "Tell RowanLane you need a carrier on a lane. Broker Operations books the load and assigns coverage."
            : "Shipper requests for a carrier. Book a load from a pending request, then assign from scorecards."}
        </p>
      </div>

      {isOps ? (
        <div className="rounded-box border border-primary/20 bg-base-100 p-4 text-sm shadow-sm">
          <p className="font-semibold">Coverage process</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 opacity-80">
            <li>Shipper submits a coverage request (lane + dates).</li>
            <li>Broker/manager reviews here and books an unassigned load.</li>
            <li>Assign a Preferred / Approved carrier from the load (scorecards).</li>
            <li>Shipper tracks the load on My Shipments once it exists.</li>
          </ol>
        </div>
      ) : (
        <div className="rounded-box border border-primary/20 bg-base-100 p-4 text-sm shadow-sm">
          <p className="font-semibold">How coverage works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 opacity-80">
            <li>Submit a request with pickup, delivery, and dates.</li>
            <li>Broker Operations books the load and finds a carrier.</li>
            <li>Track the shipment on My Shipments after it is booked.</li>
          </ol>
        </div>
      )}

      {isCustomer ? (
        <details className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100" open>
          <summary className="collapse-title font-medium">New coverage request</summary>
          <div className="collapse-content">
            <form action={createCoverageRequest} className="grid gap-3 md:grid-cols-2 pb-2">
              <input
                name="pickup_location"
                required
                placeholder="Pickup (City, ST)"
                className="input input-bordered"
              />
              <input
                name="delivery_location"
                required
                placeholder="Delivery (City, ST)"
                className="input input-bordered"
              />
              <input name="pickup_date" type="date" className="input input-bordered" />
              <input name="delivery_date" type="date" className="input input-bordered" />
              <input
                name="freight_type"
                placeholder="Freight type (e.g. Dry van)"
                className="input input-bordered"
              />
              <input
                name="weight_lbs"
                type="number"
                placeholder="Weight (lbs)"
                className="input input-bordered"
              />
              <textarea
                name="notes"
                className="textarea textarea-bordered md:col-span-2"
                placeholder="Appointment windows, special handling, preferred equipment…"
              />
              <button className="btn btn-primary md:col-span-2">Send to Broker Operations</button>
            </form>
          </div>
        </details>
      ) : null}

      {isOps && pending.length > 0 ? (
        <div className="alert alert-warning">
          <span>
            {pending.length} pending coverage request{pending.length === 1 ? "" : "s"} waiting to be
            booked.
          </span>
        </div>
      ) : null}

      {(rows ?? []).length === 0 ? (
        <p className="text-sm opacity-70">
          {isCustomer
            ? "No coverage requests yet. Submit one when you need a carrier."
            : "No coverage requests yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {(rows ?? []).map((r) => {
            const customerName = (r.customers as { name?: string } | null)?.name ?? "Customer";
            const loadNumber = (r.shipments as { load_number?: string } | null)?.load_number;
            return (
              <li
                key={r.id}
                id={`focus-${r.id}`}
                className="rounded-box border border-base-300 bg-base-100 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge badge-sm capitalize ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                      {!isCustomer ? (
                        <span className="font-medium">{customerName}</span>
                      ) : null}
                      <span className="text-xs opacity-60">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 font-medium">
                      {r.pickup_location} → {r.delivery_location}
                    </p>
                    <p className="text-sm opacity-70">
                      Pickup {r.pickup_date ?? "TBD"} · Delivery {r.delivery_date ?? "TBD"}
                      {r.freight_type ? ` · ${r.freight_type}` : ""}
                      {r.weight_lbs ? ` · ${r.weight_lbs} lbs` : ""}
                    </p>
                    {r.notes ? <p className="mt-1 text-sm opacity-60">{r.notes}</p> : null}
                    {loadNumber && r.shipment_id ? (
                      <Link
                        href={`/shipments/${r.shipment_id}`}
                        className="link link-primary mt-1 inline-block text-sm"
                      >
                        Open {loadNumber}
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {isOps && r.status === "pending" ? (
                      <>
                        <BookCoverageForm
                          requestId={r.id}
                          isManager={profile.role === "manager"}
                          customerName={customerName}
                          pastDue={pastDueByCustomer.get(r.customer_id) ?? 0}
                          onCreditHold={isOnCreditHold(
                            pastDueByCustomer.get(r.customer_id) ?? 0,
                          )}
                          action={acceptCoverageRequest}
                          contracts={(contracts ?? [])
                            .filter((c) => c.customer_id === r.customer_id)
                            .map((c) => ({
                              id: c.id,
                              contract_number: c.contract_number,
                              downpayment_pct: c.downpayment_pct,
                            }))}
                        />
                        <details>
                          <summary className="btn btn-ghost btn-xs cursor-pointer">Decline…</summary>
                          <form action={declineCoverageRequest} className="mt-2 flex flex-col gap-2">
                            <input type="hidden" name="request_id" value={r.id} />
                            <input
                              name="note"
                              required
                              minLength={3}
                              placeholder="Reason for shipper"
                              className="input input-bordered input-sm"
                            />
                            <button className="btn btn-error btn-sm">Confirm decline</button>
                          </form>
                        </details>
                      </>
                    ) : null}
                    {isCustomer && r.status === "pending" ? (
                      <form action={cancelCoverageRequest}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <button className="btn btn-ghost btn-sm">Cancel request</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
