import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { recordPayment } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";
import { canManageBilling } from "@/lib/roles";

export default async function PaymentsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "carrier" || profile.role === "broker" || profile.role === "customer") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("*, invoices(invoice_number, total, amount_paid, status, customers(name))")
    .order("payment_date", { ascending: false });
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, amount_paid, status, customers(name)")
    .in("status", ["pending", "sent", "partial", "overdue"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm opacity-70">
          Simulated collections — no real bank money moves. Balances update automatically.
        </p>
      </div>

      {canManageBilling(profile.role) ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Record payment</h2>
            <form action={recordPayment} className="grid gap-3 md:grid-cols-2">
              <select name="invoice_id" required className="select select-bordered md:col-span-2">
                <option value="">Open invoice…</option>
                {(openInvoices ?? []).map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} · {(inv.customers as { name?: string } | null)?.name} · bal{" "}
                    {money(Number(inv.total) - Number(inv.amount_paid))}
                  </option>
                ))}
              </select>
              <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input input-bordered" />
              <input name="amount" type="number" step="0.01" required placeholder="Amount" className="input input-bordered" />
              <select name="method" className="select select-bordered">
                <option value="ach_simulated">ACH (simulated)</option>
                <option value="wire_simulated">Wire (simulated)</option>
                <option value="check_simulated">Check (simulated)</option>
              </select>
              <input name="reference" placeholder="Reference #" className="input input-bordered" />
              <button className="btn btn-primary md:col-span-2">Save payment</button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-box bg-base-100 shadow-sm">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Invoice status</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id}>
                <td>{p.payment_date}</td>
                <td>{(p.invoices as { invoice_number?: string } | null)?.invoice_number}</td>
                <td>{money(p.amount)}</td>
                <td>{p.method}</td>
                <td>
                  <span className={`badge ${statusBadge((p.invoices as { status?: string } | null)?.status ?? "")}`}>
                    {(p.invoices as { status?: string } | null)?.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
