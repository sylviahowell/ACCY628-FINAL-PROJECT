import { requirePathAccess } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";
import { StatusPie } from "@/components/Charts";
import Link from "next/link";

export default async function AccountsReceivablePage() {
  await requirePathAccess("/ar");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, customers(name)")
    .order("due_date");

  const open = (invoices ?? []).filter(
    (i) => Number(i.total) - Number(i.amount_paid) > 0 && i.status !== "cancelled",
  );
  const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
  for (const inv of open) {
    const bal = Number(inv.total) - Number(inv.amount_paid);
    const days = Math.floor(
      (Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days <= 0) aging.current += bal;
    else if (days <= 30) aging.d30 += bal;
    else if (days <= 60) aging.d60 += bal;
    else aging.d90 += bal;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounts Receivable</h1>
        <p className="text-sm opacity-70">
          Who owes us money, how old the balance is, and what is past due.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stats bg-base-100 shadow-sm"><div className="stat"><div className="stat-title">Current</div><div className="stat-value text-xl">{money(aging.current)}</div></div></div>
        <div className="stats bg-base-100 shadow-sm"><div className="stat"><div className="stat-title">1–30 days</div><div className="stat-value text-xl">{money(aging.d30)}</div></div></div>
        <div className="stats bg-base-100 shadow-sm"><div className="stat"><div className="stat-title">31–60 days</div><div className="stat-value text-xl">{money(aging.d60)}</div></div></div>
        <div className="stats bg-base-100 shadow-sm"><div className="stat"><div className="stat-title">60+ days</div><div className="stat-value text-xl text-error">{money(aging.d90)}</div></div></div>
      </div>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Aging mix</h2>
          <StatusPie
            data={[
              { name: "Current", value: Math.round(aging.current) },
              { name: "1-30", value: Math.round(aging.d30) },
              { name: "31-60", value: Math.round(aging.d60) },
              { name: "60+", value: Math.round(aging.d90) },
            ]}
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-box bg-base-100 shadow-sm">
        <table className="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Balance</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {open.map((i) => (
              <tr key={i.id}>
                <td>{i.invoice_number}</td>
                <td>{(i.customers as { name?: string } | null)?.name}</td>
                <td><span className={`badge ${statusBadge(i.status)}`}>{i.status}</span></td>
                <td>{money(Number(i.total) - Number(i.amount_paid))}</td>
                <td className={i.due_date < today ? "text-error font-medium" : ""}>{i.due_date}</td>
                <td><Link href="/payments" className="link link-primary text-sm">Collect</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
