import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { generateInvoice, openDispute } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";
import { canManageBilling } from "@/lib/roles";

export default async function InvoicesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "carrier" || profile.role === "broker") redirect("/dashboard");

  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, customers(name), shipments(load_number)")
    .order("issue_date", { ascending: false });

  const billedIds = new Set(
    (invoices ?? [])
      .filter((i) => i.status !== "cancelled" && i.shipment_id)
      .map((i) => i.shipment_id as string),
  );

  let readyToBill: {
    id: string;
    load_number: string;
    status: string;
    customer_rate: number;
    customers: { name?: string } | null;
    proof_of_delivery: { id: string; signed_by: string | null }[] | null;
  }[] = [];

  if (canManageBilling(profile.role)) {
    const { data } = await supabase
      .from("shipments")
      .select(
        "id, load_number, status, customer_rate, customers(name), proof_of_delivery(id, signed_by)",
      )
      .in("status", ["delivered", "completed"]);
    readyToBill = (data ?? []).filter((s) => !billedIds.has(s.id)) as typeof readyToBill;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {profile.role === "customer" ? "My Invoices" : "Invoices"}
        </h1>
        <p className="text-sm opacity-70">
          Generated after delivery + proof of delivery. Duplicate numbers are blocked.
        </p>
      </div>

      {canManageBilling(profile.role) && readyToBill.length > 0 ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Ready to bill</h2>
            <p className="text-sm opacity-70">
              Delivered loads with POD that still need an invoice.
            </p>
            <div className="space-y-3">
              {readyToBill.map((s) => {
                const pods = s.proof_of_delivery ?? [];
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-base-300 p-3"
                  >
                    <div>
                      <p className="font-medium">{s.load_number}</p>
                      <p className="text-sm opacity-70">
                        {(s.customers as { name?: string } | null)?.name} · {money(s.customer_rate)} ·{" "}
                        <span className={`badge badge-sm ${statusBadge(s.status)}`}>{s.status}</span>
                      </p>
                      <p className="text-xs opacity-60">
                        POD:{" "}
                        {pods.length
                          ? `signed by ${pods[0]?.signed_by ?? "receiver"}`
                          : "missing — cannot invoice until uploaded"}
                      </p>
                    </div>
                    {pods.length ? (
                      <form action={generateInvoice.bind(null, s.id)}>
                        <button className="btn btn-primary btn-sm">Generate invoice</button>
                      </form>
                    ) : (
                      <span className="badge badge-warning">Awaiting POD</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

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
                {profile.role === "customer" || profile.role === "manager" || profile.role === "billing" ? (
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
        {(invoices ?? []).length === 0 ? (
          <p className="text-sm opacity-70">No invoices yet.</p>
        ) : null}
      </div>
    </div>
  );
}
