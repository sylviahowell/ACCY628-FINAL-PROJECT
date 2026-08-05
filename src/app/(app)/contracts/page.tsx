import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
import { getCurrentProfile } from "@/lib/actions/auth";
import {
  createContract,
  markContractExpired,
  renewContract,
  terminateContract,
} from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { isOperations } from "@/lib/types";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isOperations(profile.role)) redirect("/dashboard");

  const params = await resolveSearchParams(searchParams);
  const expiringOnly = params.filter === "expiring";

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
        (c) =>
          c.status === "active" &&
          c.end_date &&
          c.end_date <= soonStr,
      )
    : allContracts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contracts</h1>
        <p className="text-sm opacity-70">
          Structured shipping agreements — rates, fuel surcharge, and payment terms drive booking
          and invoicing.
        </p>
      </div>

      {expiringOnly ? (
        <FilterBanner label="contracts ending within 30 days (or already past end)" clearHref="/contracts" />
      ) : null}

      <details className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100">
        <summary className="collapse-title font-medium">New contract</summary>
        <div className="collapse-content">
          <form action={createContract} className="grid gap-3 md:grid-cols-2 pb-2">
            <input name="contract_number" required placeholder="Contract number" className="input input-bordered" />
            <select name="customer_id" required className="select select-bordered">
              <option value="">Customer…</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input name="title" required placeholder="Title" className="input input-bordered md:col-span-2" />
            <input name="start_date" type="date" required className="input input-bordered" />
            <input name="end_date" type="date" className="input input-bordered" />
            <input name="shipping_rates" placeholder="Shipping rates summary (e.g. $2500 Chicago-Dallas)" className="input input-bordered" />
            <input name="fuel_surcharge_pct" type="number" step="0.1" defaultValue={8} placeholder="Fuel surcharge %" className="input input-bordered" />
            <input name="payment_terms" defaultValue="Net 30" className="input input-bordered" />
            <label className="label cursor-pointer justify-start gap-3">
              <input name="renewal_option" type="checkbox" defaultChecked className="checkbox" />
              <span className="label-text">Renewal option</span>
            </label>
            <textarea name="notes" className="textarea textarea-bordered md:col-span-2" placeholder="Notes" />
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
      <div className="overflow-x-auto rounded-box bg-base-100 shadow-sm">
        <table className="table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Customer</th>
              <th>Dates</th>
              <th>Terms</th>
              <th>Status</th>
              <th>Lifecycle</th>
            </tr>
          </thead>
          <tbody>
            {visibleContracts.map((c) => {
              const pastEnd = c.end_date && c.end_date < today && c.status === "active";
              return (
                <tr key={c.id}>
                  <td>
                    <div className="font-medium">{c.contract_number}</div>
                    <div className="text-xs opacity-60">{c.title}</div>
                    {c.shipping_rates ? (
                      <div className="text-xs opacity-50">{c.shipping_rates}</div>
                    ) : null}
                  </td>
                  <td>{(c.customers as { name?: string } | null)?.name}</td>
                  <td className="text-sm">
                    {c.start_date} → {c.end_date ?? "open"}
                    {pastEnd ? (
                      <div className="text-xs text-warning">Past end date</div>
                    ) : null}
                  </td>
                  <td className="text-sm">
                    {c.payment_terms ?? c.billing_terms}
                    <div className="text-xs opacity-60">Fuel {c.fuel_surcharge_pct}%</div>
                    {c.renewal_option ? (
                      <div className="text-xs opacity-50">Renewable</div>
                    ) : null}
                  </td>
                  <td>
                    <span className="badge badge-outline capitalize">{c.status}</span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      {c.status === "active" && c.renewal_option ? (
                        <form action={renewContract}>
                          <input type="hidden" name="contract_id" value={c.id} />
                          <button className="btn btn-ghost btn-xs">Renew +1 yr</button>
                        </form>
                      ) : null}
                      {c.status === "active" ? (
                        <form action={terminateContract}>
                          <input type="hidden" name="contract_id" value={c.id} />
                          <button className="btn btn-ghost btn-xs text-error">Terminate</button>
                        </form>
                      ) : null}
                      {pastEnd || c.status === "active" ? (
                        <form action={markContractExpired}>
                          <input type="hidden" name="contract_id" value={c.id} />
                          <button className="btn btn-ghost btn-xs">Mark expired</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
