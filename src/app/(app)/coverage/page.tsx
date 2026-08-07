import Link from "next/link";
import { Suspense } from "react";
import { BookCoverageForm, type CoverageContractOption } from "@/components/BookCoverageForm";
import { CoverageRequestForm } from "@/components/CoverageRequestForm";
import { CoverageStatusFilter } from "@/components/CoverageStatusFilter";
import { FocusScroll } from "@/components/FocusScroll";
import { requirePathAccess } from "@/lib/authz";
import {
  acceptCoverageRequest,
  cancelCoverageRequest,
  declineCoverageRequest,
  requestCoverageManagerOverride,
} from "@/lib/actions/coverage";
import {
  isOnCreditHold,
  pastDueBalanceFromInvoices,
} from "@/lib/credit-hold";
import { createClient } from "@/lib/supabase/server";
import { isOperations, money } from "@/lib/types";

function statusBadge(status: string) {
  if (status === "pending") return "badge-warning";
  if (status === "accepted") return "badge-success";
  if (status === "declined") return "badge-error";
  return "badge-ghost";
}

function mapContractOption(c: {
  id: string;
  contract_number: string;
  title?: string | null;
  downpayment_pct: number | null;
  customer_rate_per_mile: number | null;
  carrier_rate_per_mile: number | null;
  fuel_surcharge_pct: number | null;
  shipping_rates: string | null;
  start_date: string;
  end_date: string | null;
}): CoverageContractOption {
  return {
    id: c.id,
    contract_number: c.contract_number,
    title: c.title,
    downpayment_pct: c.downpayment_pct,
    customer_rate_per_mile:
      c.customer_rate_per_mile == null ? null : Number(c.customer_rate_per_mile),
    carrier_rate_per_mile:
      c.carrier_rate_per_mile == null ? null : Number(c.carrier_rate_per_mile),
    fuel_surcharge_pct: c.fuel_surcharge_pct == null ? null : Number(c.fuel_surcharge_pct),
    shipping_rates: c.shipping_rates,
    start_date: c.start_date,
    end_date: c.end_date,
  };
}

export default async function CoveragePage() {
  const profile = await requirePathAccess("/coverage");
  const supabase = await createClient();
  const isCustomer = profile.role === "customer";
  const isOps = isOperations(profile.role);

  let query = supabase
    .from("coverage_requests")
    .select(
      "id, status, pickup_location, delivery_location, pickup_date, delivery_date, freight_type, weight_lbs, notes, shipment_id, created_at, customer_id, contract_id, miles, quoted_customer_rate, quoted_carrier_cost, customers(name), shipments(load_number), contracts(contract_number, downpayment_pct)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (isCustomer && profile.customer_id) {
    query = query.eq("customer_id", profile.customer_id);
  } else if (!isOps) {
    return (
      <div className="alert alert-warning">
        <span>Load requests are managed by customers and Broker Operations.</span>
      </div>
    );
  }

  const { data: rows } = await query;
  const pending = (rows ?? []).filter((r) => r.status === "pending");

  const { data: contracts } =
    isOps || isCustomer
      ? await supabase
          .from("contracts")
          .select(
            "id, contract_number, title, customer_id, status, start_date, end_date, downpayment_pct, fuel_surcharge_pct, shipping_rates, customer_rate_per_mile, carrier_rate_per_mile",
          )
          .eq("status", "active")
          .order("contract_number")
      : { data: [] as never[] };

  const shipperContracts = isCustomer
    ? (contracts ?? [])
        .filter((c) => c.customer_id === profile.customer_id)
        .map(mapContractOption)
    : [];

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

  const escalatedRequestIds = new Set<string>();
  if (isOps && pending.length > 0) {
    const { data: escalations } = await supabase
      .from("approval_requests")
      .select("entity_id")
      .eq("entity_type", "coverage_request")
      .eq("status", "pending")
      .in("request_type", ["credit_hold", "credit_override"])
      .in(
        "entity_id",
        pending.map((r) => r.id),
      );
    for (const e of escalations ?? []) escalatedRequestIds.add(e.entity_id);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>
      <div>
        <h1 className="text-2xl font-bold">
          {isCustomer ? "Request a load" : "Load requests"}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          {isCustomer
            ? "Submit a lane on your active contract. Broker Operations reviews credit, approves the request, then assigns a carrier."
            : "Step 2 — review miles and rates, then approve or decline. Credit holds block brokers — escalate to manager Approvals for override. After approve, assign on Assign carriers."}
        </p>
      </div>

      {isOps ? (
        <ol className="flex flex-wrap gap-2 text-sm">
          <li className="rounded-box border border-base-300 bg-base-100 px-3 py-1.5 opacity-70">
            1. Customer requests
          </li>
          <li className="rounded-box border border-primary/40 bg-primary/10 px-3 py-1.5 font-medium">
            2. Approve here (credit check)
          </li>
          <li className="rounded-box border border-base-300 bg-base-100 px-3 py-1.5 opacity-70">
            <Link href="/assign" className="link link-hover">
              3. Assign carriers
            </Link>
          </li>
        </ol>
      ) : null}

      {isCustomer ? (
        <details className="group rounded-box border border-base-300 bg-base-100" open>
          <summary className="cursor-pointer list-none px-4 py-3 font-medium marker:content-none">
            <span className="flex items-center justify-between gap-3">
              New load request
              <span className="text-xs font-normal opacity-50 group-open:hidden">Show</span>
              <span className="hidden text-xs font-normal opacity-50 group-open:inline">Hide</span>
            </span>
          </summary>
          <div className="border-t border-base-200 px-4 pb-5 pt-5">
            <CoverageRequestForm contracts={shipperContracts} />
          </div>
        </details>
      ) : null}

      {isOps && pending.length > 0 ? (
        <div className="alert alert-warning">
          <span>
            {pending.length} pending request{pending.length === 1 ? "" : "s"} waiting for approval.
            Credit holds block brokers; managers may override.
          </span>
        </div>
      ) : null}

      {(rows ?? []).length === 0 ? (
        <p className="text-sm opacity-70">
          {isCustomer
            ? "No load requests yet. Submit one when you need freight covered."
            : "No load requests yet."}
        </p>
      ) : (
        <CoverageStatusFilter>
          {(rows ?? []).map((r) => {
            const customerName = (r.customers as { name?: string } | null)?.name ?? "Customer";
            const loadNumber = (r.shipments as { load_number?: string } | null)?.load_number;
            const contractMeta = r.contracts as {
              contract_number?: string;
              downpayment_pct?: number | null;
            } | null;
            const customerContracts = (contracts ?? [])
              .filter((c) => c.customer_id === r.customer_id)
              .map(mapContractOption);
            const onHold = isOnCreditHold(pastDueByCustomer.get(r.customer_id) ?? 0);
            return (
              <li
                key={r.id}
                id={`focus-${r.id}`}
                data-status={r.status}
                className="rounded-box border border-base-300 bg-base-100 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge badge-sm capitalize ${statusBadge(r.status)}`}>
                        {r.status === "accepted" ? "approved" : r.status}
                      </span>
                      {!isCustomer ? (
                        <span className="font-medium">{customerName}</span>
                      ) : null}
                      {isOps && r.status === "pending" && onHold ? (
                        <span className="badge badge-error badge-sm">Credit hold</span>
                      ) : null}
                      {contractMeta?.contract_number ? (
                        <span className="badge badge-outline badge-sm">
                          {contractMeta.contract_number}
                          {contractMeta.downpayment_pct != null
                            ? ` · ${contractMeta.downpayment_pct}% down`
                            : ""}
                        </span>
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
                      {r.miles ? ` · ${r.miles} mi` : ""}
                    </p>
                    {r.quoted_customer_rate != null || r.quoted_carrier_cost != null ? (
                      <p className="text-sm opacity-70">
                        Quoted
                        {r.quoted_customer_rate != null
                          ? ` customer ${money(Number(r.quoted_customer_rate))}`
                          : ""}
                        {r.quoted_carrier_cost != null
                          ? ` · carrier ${money(Number(r.quoted_carrier_cost))}`
                          : ""}
                      </p>
                    ) : null}
                    {r.notes ? <p className="mt-1 text-sm opacity-60">{r.notes}</p> : null}
                    {loadNumber && r.shipment_id ? (
                      <p className="mt-1 text-sm">
                        <Link
                          href={`/shipments/${r.shipment_id}`}
                          className="link link-primary"
                        >
                          Open {loadNumber}
                        </Link>
                        {isOps ? (
                          <>
                            {" · "}
                            <Link href="/assign" className="link link-primary">
                              Assign carrier
                            </Link>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {isOps && r.status === "pending" ? (
                      <>
                        <BookCoverageForm
                          requestId={r.id}
                          isManager={profile.role === "manager"}
                          customerName={customerName}
                          pickupDate={r.pickup_date}
                          deliveryDate={r.delivery_date}
                          pickupLocation={r.pickup_location}
                          deliveryLocation={r.delivery_location}
                          initialContractId={r.contract_id}
                          initialMiles={r.miles == null ? null : Number(r.miles)}
                          initialCustomerRate={
                            r.quoted_customer_rate == null
                              ? null
                              : Number(r.quoted_customer_rate)
                          }
                          initialCarrierCost={
                            r.quoted_carrier_cost == null
                              ? null
                              : Number(r.quoted_carrier_cost)
                          }
                          pastDue={pastDueByCustomer.get(r.customer_id) ?? 0}
                          onCreditHold={onHold}
                          action={acceptCoverageRequest}
                          escalateAction={
                            profile.role === "broker"
                              ? requestCoverageManagerOverride
                              : undefined
                          }
                          alreadyEscalated={escalatedRequestIds.has(r.id)}
                          contracts={customerContracts}
                        />
                        <details>
                          <summary className="btn btn-ghost btn-xs cursor-pointer">Decline…</summary>
                          <form action={declineCoverageRequest} className="mt-2 flex flex-col gap-2">
                            <input type="hidden" name="request_id" value={r.id} />
                            <input
                              name="note"
                              required
                              minLength={3}
                              placeholder="Reason for customer"
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
        </CoverageStatusFilter>
      )}
    </div>
  );
}
