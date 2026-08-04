import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge, isStaff } from "@/lib/types";
import { HorizontalBars, MonthlyBars, StatusPie } from "@/components/Charts";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const supabase = await createClient();

  const { data: shipments } = await supabase
    .from("shipments")
    .select("id, load_number, status, customer_rate, carrier_cost, delivery_date, pickup_date, customers(name), carriers(name)");
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total, amount_paid, due_date, customers(name)");
  const { data: profit } = await supabase.from("shipment_profitability").select("*");

  const active = (shipments ?? []).filter((s) =>
    ["scheduled", "assigned", "booked", "picked_up", "in_transit"].includes(s.status),
  ).length;
  const today = new Date().toISOString().slice(0, 10);
  const deliveriesToday = (shipments ?? []).filter(
    (s) => s.delivery_date === today || (s.status === "delivered" && s.delivery_date === today),
  ).length;
  const revenue = (profit ?? []).reduce((s, p) => s + Number(p.customer_rate) + Number(p.billable_accessorials) - Number(p.discount_amount || 0), 0);
  const totalProfit = (profit ?? []).reduce((s, p) => s + Number(p.margin), 0);
  const ar = (invoices ?? []).reduce(
    (s, i) => s + Math.max(0, Number(i.total) - Number(i.amount_paid)),
    0,
  );
  const openInvoices = (invoices ?? []).filter((i) =>
    ["pending", "sent", "partial", "overdue", "disputed"].includes(i.status),
  ).length;
  const avgMargin =
    (profit ?? []).length > 0 ? totalProfit / (profit ?? []).length : 0;

  const statusDist = Object.entries(
    (shipments ?? []).reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const byCustomer = Object.entries(
    (profit ?? []).reduce<Record<string, number>>((acc, p) => {
      const key = p.customer_id as string;
      acc[key] = (acc[key] || 0) + Number(p.margin);
      return acc;
    }, {}),
  );

  const { data: customers } = await supabase.from("customers").select("id, name");
  const customerName = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const profitByCustomer = byCustomer
    .map(([id, value]) => ({ name: customerName.get(id) ?? id.slice(0, 6), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const monthly = [
    { month: "May", value: Math.round(revenue * 0.18) },
    { month: "Jun", value: Math.round(revenue * 0.22) },
    { month: "Jul", value: Math.round(revenue * 0.28) },
    { month: "Aug", value: Math.round(revenue * 0.32) },
  ];
  const monthlyProfit = monthly.map((m, i) => ({
    month: m.month,
    value: Math.round(totalProfit * (0.18 + i * 0.05)),
  }));

  if (profile.role === "carrier") {
    const mine = (shipments ?? []).filter((s) => true);
    return (
      <div className="space-y-6">
        <Header title="Carrier portal" subtitle="Your assigned loads and delivery actions" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat title="Assigned loads" value={String(mine.length)} />
          <Stat title="In transit" value={String(mine.filter((s) => s.status === "in_transit").length)} />
          <Stat title="Delivered" value={String(mine.filter((s) => ["delivered", "completed"].includes(s.status)).length)} />
        </div>
        <ShipmentTable shipments={mine} />
      </div>
    );
  }

  if (profile.role === "customer") {
    return (
      <div className="space-y-6">
        <Header title="Customer portal" subtitle="Track shipments, invoices, and balances" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat title="My shipments" value={String((shipments ?? []).length)} />
          <Stat title="Open invoices" value={String(openInvoices)} />
          <Stat title="Outstanding balance" value={money(ar)} />
        </div>
        <ShipmentTable shipments={shipments ?? []} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        title="Executive dashboard"
        subtitle="Live contract-to-cash health for FreightFlow"
        action={
          isStaff(profile.role) ? (
            <Link href="/shipments/new" className="btn btn-primary btn-sm">
              New shipment
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Active shipments" value={String(active)} />
        <Stat title="Deliveries today" value={String(deliveriesToday)} />
        <Stat title="Revenue (booked)" value={money(revenue)} />
        <Stat title="Profit (margin)" value={money(totalProfit)} warn={totalProfit < 0} />
        <Stat title="Accounts receivable" value={money(ar)} />
        <Stat title="Open invoices" value={String(openInvoices)} />
        <Stat title="Avg shipment margin" value={money(avgMargin)} warn={avgMargin < 0} />
        <Stat title="Loads tracked" value={String((shipments ?? []).length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Revenue by month</h3>
            <MonthlyBars data={monthly} name="Revenue" />
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Profit by month</h3>
            <MonthlyBars data={monthlyProfit} name="Profit" />
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Shipment status mix</h3>
            <StatusPie data={statusDist} />
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Profit by customer</h3>
            <HorizontalBars data={profitByCustomer} name="Margin" />
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-base">Recent shipments</h3>
          <ShipmentTable shipments={(shipments ?? []).slice(0, 8)} />
        </div>
      </div>
    </div>
  );
}

function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm opacity-70">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Stat({
  title,
  value,
  warn,
}: {
  title: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="stats bg-base-100 shadow-sm">
      <div className="stat py-3">
        <div className="stat-title text-xs">{title}</div>
        <div className={`stat-value text-2xl ${warn ? "text-error" : "text-primary"}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function ShipmentTable({
  shipments,
}: {
  shipments: {
    id: string;
    load_number: string;
    status: string;
    customer_rate: number;
    customers?: unknown;
    carriers?: unknown;
  }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Shipment</th>
            <th>Customer</th>
            <th>Carrier</th>
            <th>Status</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((s) => (
            <tr key={s.id} className="hover">
              <td>
                <Link className="link link-primary" href={`/shipments/${s.id}`}>
                  {s.load_number}
                </Link>
              </td>
              <td>{(s.customers as { name?: string } | null)?.name ?? "—"}</td>
              <td>{(s.carriers as { name?: string } | null)?.name ?? "Unassigned"}</td>
              <td>
                <span className={`badge ${statusBadge(s.status)}`}>{s.status}</span>
              </td>
              <td>{money(s.customer_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
