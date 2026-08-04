import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { openDispute, recordPayment } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";

export default async function BillingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, total, amount_paid, due_date, issue_date, shipment_id, customers(name)",
    )
    .order("issue_date", { ascending: false });

  const { data: disputes } = await supabase
    .from("disputes")
    .select("id, reason, amount_disputed, status, invoice_id, created_at")
    .order("created_at", { ascending: false });

  const { data: profit } = await supabase
    .from("shipment_profitability")
    .select("load_number, margin, customer_rate, carrier_cost, status");

  const canPay = ["manager", "billing"].includes(profile.role);
  const canDispute = ["customer", "billing", "manager"].includes(profile.role);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0f2744]">
          Billing & collections
        </h2>
        <p className="text-sm text-slate-600">
          Simulated invoices and payments — no real bank movement. Disputed
          invoices cannot be marked fully collected until resolved.
        </p>
      </div>

      {profile.role === "manager" || profile.role === "billing" ? (
        <section className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Profitability by load
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Load</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Sell</th>
                  <th className="py-2 pr-4">Buy</th>
                  <th className="py-2">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(profit ?? []).map((p) => (
                  <tr key={p.load_number} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{p.load_number}</td>
                    <td className="py-2 pr-4">{p.status}</td>
                    <td className="py-2 pr-4">{money(p.customer_rate)}</td>
                    <td className="py-2 pr-4">{money(p.carrier_cost)}</td>
                    <td
                      className={`py-2 font-medium ${Number(p.margin) < 0 ? "text-rose-700" : "text-emerald-700"}`}
                    >
                      {money(p.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Invoices
        </h3>
        <ul className="space-y-4">
          {(invoices ?? []).map((inv) => {
            const balance = Number(inv.total) - Number(inv.amount_paid);
            return (
              <li
                key={inv.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#0f2744]">
                      {inv.invoice_number}{" "}
                      <span className="text-xs font-normal uppercase text-slate-500">
                        {inv.status}
                      </span>
                    </p>
                    <p className="text-sm text-slate-600">
                      {(inv.customers as { name?: string } | null)?.name ??
                        "Customer"}{" "}
                      · Due {inv.due_date}
                    </p>
                    <p className="mt-1 text-sm">
                      Total {money(inv.total)} · Paid {money(inv.amount_paid)} ·
                      Balance {money(balance)}
                    </p>
                  </div>
                </div>

                {canPay && balance > 0 && inv.status !== "cancelled" ? (
                  <form
                    action={recordPayment}
                    className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3"
                  >
                    <input type="hidden" name="invoice_id" value={inv.id} />
                    <label className="text-xs">
                      Amount
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        max={balance}
                        defaultValue={balance}
                        required
                        className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs">
                      Reference
                      <input
                        name="reference"
                        placeholder="ACH ref"
                        className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-md bg-[#0f2744] px-3 py-1.5 text-sm text-white"
                    >
                      Record payment
                    </button>
                  </form>
                ) : null}

                {canDispute && inv.status !== "cancelled" ? (
                  <form
                    action={openDispute}
                    className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3"
                  >
                    <input type="hidden" name="invoice_id" value={inv.id} />
                    <input
                      type="hidden"
                      name="shipment_id"
                      value={inv.shipment_id ?? ""}
                    />
                    <label className="grow text-xs">
                      Dispute reason
                      <input
                        name="reason"
                        required
                        className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs">
                      Amount
                      <input
                        name="amount_disputed"
                        type="number"
                        step="0.01"
                        defaultValue={balance}
                        className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-md border border-amber-600 px-3 py-1.5 text-sm text-amber-800"
                    >
                      Open dispute
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Disputes
        </h3>
        <ul className="space-y-2 text-sm">
          {(disputes ?? []).map((d) => (
            <li key={d.id} className="rounded-md bg-amber-50 px-3 py-2">
              <span className="font-medium uppercase text-amber-900">
                {d.status}
              </span>{" "}
              — {d.reason} ({money(d.amount_disputed)})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
