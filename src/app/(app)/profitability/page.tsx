import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";
import { HorizontalBars, MonthlyBars } from "@/components/Charts";
import { bucketByMonth } from "@/lib/analytics";

export default async function ProfitabilityPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "manager") redirect("/dashboard");

  const supabase = await createClient();
  const { data: profit } = await supabase.from("shipment_profitability").select("*");
  const { data: customers } = await supabase.from("customers").select("id, name");
  const { data: shipments } = await supabase
    .from("shipments")
    .select("id, created_at, pickup_date, delivery_date");
  const names = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const shipDates = new Map(
    (shipments ?? []).map((s) => [
      s.id as string,
      (s.delivery_date || s.pickup_date || s.created_at) as string,
    ]),
  );

  const rows = (profit ?? [])
    .map((p) => ({
      ...p,
      customer: names.get(p.customer_id) ?? "Unknown",
      margin: Number(p.margin),
      revenue: Number(p.customer_rate) + Number(p.billable_accessorials) - Number(p.discount_amount || 0),
    }))
    .sort((a, b) => a.margin - b.margin);

  const byCustomer = Object.values(
    rows.reduce<Record<string, { name: string; value: number }>>((acc, r) => {
      acc[r.customer_id] = acc[r.customer_id] || { name: r.customer, value: 0 };
      acc[r.customer_id].value += r.margin;
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = rows.reduce((s, r) => s + r.margin, 0);
  const monthly = bucketByMonth(
    rows.map((r) => ({
      date: shipDates.get(r.shipment_id as string) ?? null,
      amount: r.margin,
    })),
    6,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profitability</h1>
        <p className="text-sm opacity-70">
          Broker profit = customer revenue − carrier cost − approved extras − discounts.
          Monthly chart uses each load&apos;s delivery (or pickup/create) date.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stats bg-base-100 shadow-sm"><div className="stat"><div className="stat-title">Shipment revenue</div><div className="stat-value text-2xl">{money(totalRevenue)}</div></div></div>
        <div className="stats bg-base-100 shadow-sm"><div className="stat"><div className="stat-title">Total profit</div><div className={`stat-value text-2xl ${totalProfit < 0 ? "text-error" : "text-success"}`}>{money(totalProfit)}</div></div></div>
        <div className="stats bg-base-100 shadow-sm"><div className="stat"><div className="stat-title">Customers ranked</div><div className="stat-value text-2xl">{byCustomer.length}</div></div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm"><div className="card-body"><h3 className="card-title text-base">Monthly profit</h3><MonthlyBars data={monthly} name="Profit" /></div></div>
        <div className="card bg-base-100 shadow-sm"><div className="card-body"><h3 className="card-title text-base">Customer profitability</h3><HorizontalBars data={byCustomer} name="Margin" /></div></div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-base">Least profitable shipments</h3>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Load</th>
                  <th>Customer</th>
                  <th>Revenue</th>
                  <th>Carrier</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r) => (
                  <tr key={r.shipment_id}>
                    <td>{r.load_number}</td>
                    <td>{r.customer}</td>
                    <td>{money(r.revenue)}</td>
                    <td>{money(r.carrier_cost)}</td>
                    <td className={r.margin < 0 ? "text-error font-semibold" : "text-success"}>
                      {money(r.margin)}
                    </td>
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
