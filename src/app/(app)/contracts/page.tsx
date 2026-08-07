import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ContractLaneCalculator } from "@/components/ContractLaneCalculator";
import { EmptyState } from "@/components/EmptyState";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
import { FocusScroll } from "@/components/FocusScroll";
import { requirePathAccess } from "@/lib/authz";
import {
  createContract,
  markContractExpired,
  renewContract,
  terminateContract,
} from "@/lib/actions/freight";
import { expirePastEndContracts } from "@/lib/actions/contracts-lifecycle";
import { createClient } from "@/lib/supabase/server";
import { isOperations, money } from "@/lib/types";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const profile = await requirePathAccess("/contracts");
  if (!isOperations(profile.role)) redirect("/dashboard");

  await expirePastEndContracts();

  const params = await resolveSearchParams(searchParams);
  const expiringOnly = params.filter === "expiring";
  const q = (params.q ?? "").trim();
  const isManager = profile.role === "manager";

  const supabase = await createClient();
  const { data: contracts } = await supabase
    .from("contracts")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });
  const { data: customers } = await supabase.from("customers").select("id, name").order("name");
  const { data: pendingCoverage } = await supabase
    .from("coverage_requests")
    .select("id, customer_id, contract_id, status")
    .eq("status", "pending");
  const { data: contractShipments } = await supabase
    .from("shipments")
    .select("contract_id, carriers(name)")
    .not("contract_id", "is", null);
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date();
  soon.setUTCDate(soon.getUTCDate() + 30);
  const soonStr = soon.toISOString().slice(0, 10);

  const carriersByContract = new Map<string, Set<string>>();
  for (const s of contractShipments ?? []) {
    if (!s.contract_id) continue;
    const name = (s.carriers as { name?: string } | null)?.name;
    if (!name) continue;
    const set = carriersByContract.get(s.contract_id) ?? new Set<string>();
    set.add(name);
    carriersByContract.set(s.contract_id, set);
  }

  const allContracts = contracts ?? [];
  const needle = q.toLowerCase();
  const searchedContracts = needle
    ? allContracts.filter((c) => {
        const customerName = (c.customers as { name?: string } | null)?.name ?? "";
        const carrierNames = [...(carriersByContract.get(c.id) ?? [])].join(" ");
        const hay = [
          c.id,
          c.contract_number ?? "",
          c.title ?? "",
          c.notes ?? "",
          customerName,
          carrierNames,
          c.status ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
    : allContracts;
  const visibleContracts = expiringOnly
    ? searchedContracts.filter(
        (c) => c.status === "active" && c.end_date && c.end_date <= soonStr,
      )
    : searchedContracts;

  const pendingByCustomer = new Map<string, number>();
  const pendingByContract = new Map<string, number>();
  for (const r of pendingCoverage ?? []) {
    pendingByCustomer.set(
      r.customer_id,
      (pendingByCustomer.get(r.customer_id) ?? 0) + 1,
    );
    if (r.contract_id) {
      pendingByContract.set(
        r.contract_id,
        (pendingByContract.get(r.contract_id) ?? 0) + 1,
      );
    }
  }
  const totalPendingCoverage = (pendingCoverage ?? []).length;

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>
      <div>
        <h1 className="text-2xl font-bold">Contracts</h1>
        <p className="text-sm opacity-70">
          Setup only — shipping agreements set mile rates, downpayment %, fuel %, and payment terms.
          Daily load approval and carrier assignment happen on{" "}
          <Link href="/coverage" className="link link-primary">
            Load requests
          </Link>{" "}
          and{" "}
          <Link href="/assign" className="link link-primary">
            Assign carriers
          </Link>
          .
        </p>
      </div>

      {expiringOnly ? (
        <FilterBanner
          label="contracts ending within 30 days (or already past end)"
          clearHref={q ? `/contracts?q=${encodeURIComponent(q)}` : "/contracts"}
        />
      ) : null}

      {q ? (
        <FilterBanner
          label={`search results for “${q}” (${visibleContracts.length})`}
          clearHref={expiringOnly ? "/contracts?filter=expiring" : "/contracts"}
        />
      ) : null}

      <form
        method="get"
        action="/contracts"
        className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-3 sm:flex-row sm:items-center"
      >
        {expiringOnly ? <input type="hidden" name="filter" value="expiring" /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by contract #, customer, or carrier…"
          className="input input-bordered input-sm w-full flex-1"
          aria-label="Search contracts"
        />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary btn-sm">
            Search
          </button>
          {q ? (
            <Link
              href={expiringOnly ? "/contracts?filter=expiring" : "/contracts"}
              className="btn btn-ghost btn-sm"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <details className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100">
        <summary className="collapse-title font-medium">New contract</summary>
        <div className="collapse-content">
          <form action={createContract} className="grid gap-3 md:grid-cols-2 pb-2">
            <input
              name="contract_number"
              required
              placeholder="Contract number"
              className="input input-bordered"
            />
            <select name="customer_id" required className="select select-bordered">
              <option value="">Customer…</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              name="title"
              required
              placeholder="Title"
              className="input input-bordered md:col-span-2"
            />
            <input name="start_date" type="date" required className="input input-bordered" />
            <input name="end_date" type="date" className="input input-bordered" />
            <input
              name="shipping_rates"
              placeholder="Rate notes (optional free text)"
              className="input input-bordered"
            />
            <input
              name="fuel_surcharge_pct"
              type="number"
              step="0.1"
              defaultValue={8}
              placeholder="Fuel surcharge %"
              className="input input-bordered"
            />
            <input
              name="customer_rate_per_mile"
              type="number"
              step="0.01"
              defaultValue={3.5}
              required
              placeholder="Customer $/mile"
              className="input input-bordered"
            />
            <input
              name="carrier_rate_per_mile"
              type="number"
              step="0.01"
              defaultValue={2.75}
              required
              placeholder="Carrier $/mile"
              className="input input-bordered"
            />
            <input
              name="downpayment_pct"
              type="number"
              step="0.1"
              min={0}
              max={100}
              defaultValue={20}
              required
              placeholder="Customer downpayment %"
              className="input input-bordered"
            />
            <input name="payment_terms" defaultValue="Net 30" className="input input-bordered" />
            <label className="label cursor-pointer justify-start gap-3">
              <input name="renewal_option" type="checkbox" defaultChecked className="checkbox" />
              <span className="label-text">Renewal option</span>
            </label>
            <textarea
              name="notes"
              className="textarea textarea-bordered md:col-span-2"
              placeholder="Notes"
            />
            <p className="md:col-span-2 text-xs opacity-60">
              Quote formula: customer total = miles × customer $/mi + fuel %; carrier pay = miles ×
              carrier $/mi; downpayment = customer total × downpayment %.
            </p>
            <button className="btn btn-primary md:col-span-2">Save contract</button>
          </form>
        </div>
      </details>

      {visibleContracts.length === 0 ? (
        <EmptyState
          title={
            q
              ? "No contracts match your search"
              : expiringOnly
                ? "No expiring contracts"
                : "No contracts yet"
          }
          description={
            q
              ? "Try a contract number, customer name, or carrier that hauled on the contract."
              : expiringOnly
                ? "No active contracts end within the next 30 days."
                : "Create a shipping agreement to drive rates and payment terms on new loads."
          }
          action={
            q || expiringOnly ? (
              <Link href="/contracts" className="btn btn-outline btn-sm">
                Show all contracts
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleContracts.map((c) => {
            const pastEnd = c.end_date && c.end_date < today && c.status === "active";
            const pricing = {
              fuel_surcharge_pct: c.fuel_surcharge_pct,
              downpayment_pct: c.downpayment_pct,
              customer_rate_per_mile: c.customer_rate_per_mile,
              carrier_rate_per_mile: c.carrier_rate_per_mile,
            };
            return (
              <div
                key={c.id}
                id={`focus-${c.contract_number}`}
                data-focus={c.contract_number}
                className="card bg-base-100 shadow-sm transition"
              >
                <div className="card-body gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="card-title text-base">
                        {c.contract_number}{" "}
                        <span className="badge badge-outline badge-sm capitalize">{c.status}</span>
                      </h3>
                      <p className="text-sm opacity-70">
                        {(c.customers as { name?: string } | null)?.name} · {c.title}
                      </p>
                      {(carriersByContract.get(c.id)?.size ?? 0) > 0 ? (
                        <p className="text-xs opacity-60">
                          Carriers on loads: {[...(carriersByContract.get(c.id) ?? [])].join(", ")}
                        </p>
                      ) : null}
                      <p className="text-xs opacity-60">
                        {c.start_date} → {c.end_date ?? "open"}
                        {pastEnd ? " · Past end date" : ""}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>
                        Customer {money(c.customer_rate_per_mile)}/mi · Carrier{" "}
                        {money(c.carrier_rate_per_mile)}/mi
                      </p>
                      <p className="opacity-70">
                        Downpayment {Number(c.downpayment_pct ?? 20)}% · Fuel{" "}
                        {Number(c.fuel_surcharge_pct ?? 0)}% · {c.payment_terms ?? c.billing_terms}
                      </p>
                      {c.renewal_option ? (
                        <p className="text-xs opacity-50">Renewable</p>
                      ) : null}
                      {(pendingByContract.get(c.id) ?? 0) > 0 ||
                      (pendingByCustomer.get(c.customer_id) ?? 0) > 0 ? (
                        <p className="mt-1">
                          <Link href="/coverage" className="link link-primary text-xs">
                            {(pendingByContract.get(c.id) ?? 0) > 0
                              ? `${pendingByContract.get(c.id)} request(s) pending approval`
                              : `${pendingByCustomer.get(c.customer_id)} request(s) pending for customer`}{" "}
                            →
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <ContractLaneCalculator terms={pricing} />

                  <div className="flex flex-wrap gap-2 border-t border-base-200 pt-3">
                    {c.status === "active" && c.renewal_option ? (
                      <form action={renewContract}>
                        <input type="hidden" name="contract_id" value={c.id} />
                        <button className="btn btn-ghost btn-xs">Renew +1 yr</button>
                      </form>
                    ) : null}
                    {c.status === "active" ? (
                      <form action={terminateContract}>
                        <input type="hidden" name="contract_id" value={c.id} />
                        <button className="btn btn-ghost btn-xs text-error" title="End agreement early (ops only)">
                          End contract (ops)
                        </button>
                      </form>
                    ) : null}
                    {pastEnd || c.status === "active" ? (
                      <form action={markContractExpired}>
                        <input type="hidden" name="contract_id" value={c.id} />
                        <button className="btn btn-ghost btn-xs" title="Mark past end date as expired">
                          Mark expired
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-box border border-primary/20 bg-base-100 p-4 shadow-sm">
        <h2 className="font-semibold">Where contracts fit</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm opacity-80">
          <li>Ops creates or renews an active contract for the customer (this page).</li>
          <li>
            Customer submits a load request on that contract → broker{" "}
            <Link href="/coverage" className="link link-primary">
              approves
            </Link>{" "}
            (blocked on credit hold).
          </li>
          <li>
            Broker{" "}
            <Link href="/assign" className="link link-primary">
              assigns a carrier
            </Link>{" "}
            (blocked if insurance expired).
          </li>
          <li>
            After delivery + POD, Billing runs AR / AP
            {isManager ? (
              <>
                {" "}
                — <Link href="/invoices" className="link link-primary">Invoices</Link> /{" "}
                <Link href="/ar" className="link link-primary">AR</Link> /{" "}
                <Link href="/ap" className="link link-primary">AP</Link>
              </>
            ) : (
              " in the Billing portal"
            )}
            .
          </li>
        </ol>
        <p className="mt-2 text-xs opacity-60">
          Only RowanLane operations can renew or end a contract. Customers and carriers request
          changes through Support — they cannot cancel agreements in the portal.
        </p>
        {totalPendingCoverage > 0 ? (
          <p className="mt-3 text-sm">
            <Link href="/coverage" className="link link-primary font-medium">
              {totalPendingCoverage} load request
              {totalPendingCoverage === 1 ? "" : "s"}
            </Link>{" "}
            waiting for approval (not approved here).
          </p>
        ) : null}
      </div>
    </div>
  );
}
