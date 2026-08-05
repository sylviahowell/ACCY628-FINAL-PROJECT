import Link from "next/link";
import { redirect } from "next/navigation";
import { ContractLaneCalculator } from "@/components/ContractLaneCalculator";
import { EmptyState } from "@/components/EmptyState";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
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
  const isManager = profile.role === "manager";

  const supabase = await createClient();
  const { data: contracts } = await supabase
    .from("contracts")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });
  const { data: customers } = await supabase.from("customers").select("id, name").order("name");
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date();
  soon.setUTCDate(soon.getUTCDate() + 30);
  const soonStr = soon.toISOString().slice(0, 10);

  const allContracts = contracts ?? [];
  const visibleContracts = expiringOnly
    ? allContracts.filter(
        (c) => c.status === "active" && c.end_date && c.end_date <= soonStr,
      )
    : allContracts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contracts</h1>
        <p className="text-sm opacity-70">
          Shipping agreements set mile rates, customer downpayment, fuel %, and payment terms that
          drive booking and cash.
        </p>
      </div>

      <div className="rounded-box border border-primary/20 bg-base-100 p-4 shadow-sm">
        <h2 className="font-semibold">Contract → cash</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm opacity-80">
          <li>Book the load on the contract (mile rates + downpayment %).</li>
          <li>
            At booking, a downpayment invoice (DEP-…) is created for the shipper; balance invoices
            after delivery + POD.
          </li>
          <li>Deliver freight and collect POD.</li>
          <li>
            Billing invoices the customer (AR)
            {isManager ? (
              <>
                {" "}
                — <Link href="/invoices" className="link link-primary">Invoices</Link> /{" "}
                <Link href="/ar" className="link link-primary">AR</Link>
              </>
            ) : (
              " — run in the Billing portal"
            )}
            .
          </li>
          <li>
            Billing pays the carrier (AP / payables)
            {isManager ? (
              <>
                {" "}
                — <Link href="/ap" className="link link-primary">Accounts Payable</Link>
              </>
            ) : (
              " — run in the Billing portal"
            )}
            .
          </li>
        </ol>
        <p className="mt-2 text-xs opacity-60">
          Only RowanLane operations can renew or end a contract. Customers and carriers request
          changes through Support — they cannot cancel agreements in the portal.
        </p>
      </div>

      {expiringOnly ? (
        <FilterBanner
          label="contracts ending within 30 days (or already past end)"
          clearHref="/contracts"
        />
      ) : null}

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
          title={expiringOnly ? "No expiring contracts" : "No contracts yet"}
          description={
            expiringOnly
              ? "No active contracts end within the next 30 days."
              : "Create a shipping agreement to drive rates and payment terms on new loads."
          }
          action={
            expiringOnly ? (
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
              <div key={c.id} className="card bg-base-100 shadow-sm">
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
    </div>
  );
}
