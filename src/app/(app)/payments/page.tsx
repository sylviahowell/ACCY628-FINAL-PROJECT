import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
import { requirePathAccess } from "@/lib/authz";
import { recordPayment } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";
import { canManageBilling } from "@/lib/roles";

function paymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case "ach_simulated":
    case "ach":
      return "ACH";
    case "wire_simulated":
    case "wire":
      return "Wire";
    case "check_simulated":
    case "check":
      return "Check";
    default:
      return method?.replace(/_simulated$/i, "").toUpperCase() || "—";
  }
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const profile = await requirePathAccess("/payments");
  if (profile.role === "carrier" || profile.role === "broker" || profile.role === "customer") {
    redirect("/dashboard");
  }

  const params = await resolveSearchParams(searchParams);
  const filter = params.filter;
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("*, invoices(invoice_number, total, amount_paid, status, customers(name))")
    .order("payment_date", { ascending: false });
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, amount_paid, status, customers(name)")
    .in("status", ["pending", "sent", "partial", "overdue"]);

  const recorderIds = [
    ...new Set((payments ?? []).map((p) => p.recorded_by).filter(Boolean) as string[]),
  ];
  const { data: recorders } = recorderIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", recorderIds)
    : { data: [] as { id: string; full_name: string }[] };
  const recorderName = new Map((recorders ?? []).map((p) => [p.id, p.full_name]));

  const allRows = payments ?? [];
  const rows =
    filter === "today"
      ? allRows.filter((p) => p.payment_date === today)
      : filter === "month"
        ? allRows.filter((p) => (p.payment_date ?? "").startsWith(monthPrefix))
        : allRows;
  const filterLabel =
    filter === "today"
      ? "payments received today"
      : filter === "month"
        ? "payments received this month"
        : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm opacity-70">
          Record customer collections. Invoice balances update automatically.
        </p>
      </div>

      {filterLabel ? <FilterBanner label={filterLabel} clearHref="/payments" /> : null}

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
                <option value="ach_simulated">ACH</option>
                <option value="wire_simulated">Wire</option>
                <option value="check_simulated">Check</option>
              </select>
              <input name="reference" placeholder="Reference #" className="input input-bordered" />
              <button className="btn btn-primary md:col-span-2">Save payment</button>
            </form>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title={filterLabel ? "No matching payments" : "No payments recorded"}
          description={
            filterLabel
              ? "Nothing matches this filter right now."
              : "When you collect against an open invoice, the payment appears here and the invoice balance updates."
          }
          action={
            filterLabel ? (
              <Link href="/payments" className="btn btn-outline btn-sm">
                Show all payments
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-box bg-base-100 shadow-sm">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Recorded by</th>
                <th>Invoice status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.payment_date}</td>
                  <td>{(p.invoices as { invoice_number?: string } | null)?.invoice_number}</td>
                  <td>{money(p.amount)}</td>
                  <td>{paymentMethodLabel(p.method)}</td>
                  <td className="text-sm">
                    {p.recorded_by ? recorderName.get(p.recorded_by) ?? "Staff" : "—"}
                  </td>
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
      )}
    </div>
  );
}
