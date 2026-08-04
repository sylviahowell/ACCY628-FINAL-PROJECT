import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { openDispute } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";

export default async function InvoicesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "carrier") redirect("/dashboard");

  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, customers(name), shipments(load_number)")
    .order("issue_date", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-sm opacity-70">
          Generated after delivery + proof of delivery. Duplicate numbers are blocked.
        </p>
      </div>
      <div className="space-y-4">
        {(invoices ?? []).map((inv) => {
          const balance = Number(inv.total) - Number(inv.amount_paid);
          return (
            <div key={inv.id} className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{inv.invoice_number}</h3>
                    <p className="text-sm opacity-70">
                      {(inv.customers as { name?: string } | null)?.name} · Shipment{" "}
                      {(inv.shipments as { load_number?: string } | null)?.load_number ?? "—"}
                    </p>
                    <p className="text-sm">
                      Due {inv.due_date} · Total {money(inv.total)} · Paid {money(inv.amount_paid)} ·
                      Balance {money(balance)}
                    </p>
                  </div>
                  <span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span>
                </div>
                {profile.role === "customer" || profile.role === "manager" || profile.role === "broker" ? (
                  <form action={openDispute} className="mt-2 flex flex-wrap gap-2 border-t border-base-200 pt-3">
                    <input type="hidden" name="invoice_id" value={inv.id} />
                    <input type="hidden" name="shipment_id" value={inv.shipment_id ?? ""} />
                    <input name="reason" required placeholder="Dispute reason" className="input input-bordered input-sm grow" />
                    <input name="amount_disputed" type="number" step="0.01" defaultValue={balance} className="input input-bordered input-sm w-28" />
                    <button className="btn btn-warning btn-sm">Submit dispute</button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
