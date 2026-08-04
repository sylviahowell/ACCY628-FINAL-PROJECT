import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { isStaff, money, statusBadge } from "@/lib/types";
import { StatusPie } from "@/components/Charts";

export default async function ReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("invoice_number, status, total, amount_paid, due_date, customers(name)");
  const { data: carriers } = await supabase.from("carriers").select("id, name, rating");
  const { data: shipments } = await supabase.from("shipments").select("carrier_id, status");

  const agingBuckets = { current: 0, d30: 0, d60: 0, d90: 0 };
  const today = new Date();
  for (const inv of invoices ?? []) {
    const bal = Number(inv.total) - Number(inv.amount_paid);
    if (bal <= 0 || ["paid", "cancelled"].includes(inv.status)) continue;
    const due = new Date(inv.due_date);
    const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) agingBuckets.current += bal;
    else if (days <= 30) agingBuckets.d30 += bal;
    else if (days <= 60) agingBuckets.d60 += bal;
    else agingBuckets.d90 += bal;
  }

  const agingChart = [
    { name: "Current", value: Math.round(agingBuckets.current) },
    { name: "1-30", value: Math.round(agingBuckets.d30) },
    { name: "31-60", value: Math.round(agingBuckets.d60) },
    { name: "60+", value: Math.round(agingBuckets.d90) },
  ];

  const carrierPerf = (carriers ?? []).map((c) => {
    const loads = (shipments ?? []).filter((s) => s.carrier_id === c.id);
    const delivered = loads.filter((s) => ["delivered", "completed"].includes(s.status)).length;
    return { name: c.name, rating: c.rating, loads: loads.length, delivered };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm opacity-70">Invoice aging and carrier performance snapshots.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Invoice aging</h3>
            <StatusPie data={agingChart} />
            <ul className="text-sm mt-2 space-y-1">
              <li>Current: {money(agingBuckets.current)}</li>
              <li>1–30 days: {money(agingBuckets.d30)}</li>
              <li>31–60 days: {money(agingBuckets.d60)}</li>
              <li>60+ days: {money(agingBuckets.d90)}</li>
            </ul>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Carrier performance</h3>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Carrier</th>
                    <th>Rating</th>
                    <th>Loads</th>
                    <th>Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {carrierPerf.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td>{c.rating ?? "—"}</td>
                      <td>{c.loads}</td>
                      <td>{c.delivered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-base">Open invoice detail</h3>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {(invoices ?? [])
                  .filter((i) => Number(i.total) - Number(i.amount_paid) > 0)
                  .map((i) => (
                    <tr key={i.invoice_number}>
                      <td>{i.invoice_number}</td>
                      <td>{(i.customers as { name?: string } | null)?.name}</td>
                      <td><span className={`badge ${statusBadge(i.status)}`}>{i.status}</span></td>
                      <td>{money(Number(i.total) - Number(i.amount_paid))}</td>
                      <td>{i.due_date}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
