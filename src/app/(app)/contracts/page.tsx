import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createContract } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/types";

export default async function ContractsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: contracts } = await supabase
    .from("contracts")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });
  const { data: customers } = await supabase.from("customers").select("id, name").order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contracts</h1>
        <p className="text-sm opacity-70">
          Structured shipping agreements — rates, fuel surcharge, and payment terms.
        </p>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">New contract</h2>
          <form action={createContract} className="grid gap-3 md:grid-cols-2">
            <input name="contract_number" required placeholder="Contract number" className="input input-bordered" />
            <select name="customer_id" required className="select select-bordered">
              <option value="">Customer…</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input name="title" required placeholder="Title" className="input input-bordered md:col-span-2" />
            <input name="start_date" type="date" required className="input input-bordered" />
            <input name="end_date" type="date" className="input input-bordered" />
            <input name="shipping_rates" placeholder="Shipping rates summary" className="input input-bordered" />
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
      </div>

      <div className="overflow-x-auto rounded-box bg-base-100 shadow-sm">
        <table className="table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Customer</th>
              <th>Dates</th>
              <th>Terms</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(contracts ?? []).map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="font-medium">{c.contract_number}</div>
                  <div className="text-xs opacity-60">{c.title}</div>
                </td>
                <td>{(c.customers as { name?: string } | null)?.name}</td>
                <td className="text-sm">{c.start_date} → {c.end_date ?? "open"}</td>
                <td className="text-sm">
                  {c.payment_terms ?? c.billing_terms}
                  <div className="text-xs opacity-60">Fuel {c.fuel_surcharge_pct}%</div>
                </td>
                <td><span className="badge badge-outline capitalize">{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
