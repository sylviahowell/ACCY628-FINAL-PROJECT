import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { reviewApproval } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";
import { HorizontalBars, MonthlyBars, StatusPie } from "@/components/Charts";
import { bucketByMonth } from "@/lib/analytics";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: shipments } = await supabase
    .from("shipments")
    .select(
      "id, load_number, status, customer_rate, carrier_cost, delivery_date, pickup_date, promised_delivery_date, created_at, carrier_id, customer_id, customers(name), carriers(name)",
    );
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total, amount_paid, due_date, issue_date, customers(name)");
  const { data: profit } = await supabase.from("shipment_profitability").select("*");
  const { data: customers } = await supabase.from("customers").select("id, name");
  const { data: carriers } = await supabase.from("carriers").select("id, name, rating");
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, payment_date")
    .eq("payment_date", today);
  const { data: disputes } = await supabase
    .from("disputes")
    .select("id, reason, amount_disputed, status")
    .eq("status", "open");
  const { data: approvals } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("status", "pending");
  const { data: pods } = await supabase
    .from("proof_of_delivery")
    .select("id, shipment_id, delivered_at, signed_by");

  const customerName = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const shipList = shipments ?? [];
  const invList = invoices ?? [];
  const profitList = profit ?? [];
  const profitByShipment = new Map(
    profitList.map((p) => [p.shipment_id as string, p]),
  );

  const revenue = profitList.reduce(
    (s, p) =>
      s +
      Number(p.customer_rate) +
      Number(p.billable_accessorials) -
      Number(p.discount_amount || 0),
    0,
  );
  const grossProfit = profitList.reduce((s, p) => s + Number(p.margin), 0);
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const ar = invList.reduce(
    (s, i) => s + Math.max(0, Number(i.total) - Number(i.amount_paid)),
    0,
  );
  const openInvoices = invList.filter((i) =>
    ["pending", "sent", "partial", "overdue", "disputed"].includes(i.status),
  );
  const pastDue = invList.filter((i) => {
    const bal = Number(i.total) - Number(i.amount_paid);
    return bal > 0 && i.due_date < today && !["paid", "cancelled"].includes(i.status);
  });

  // Real monthly series: invoice issue dates for revenue; shipment activity dates for margin
  const monthlyRev = bucketByMonth(
    invList
      .filter((i) => i.status !== "cancelled")
      .map((i) => ({ date: i.issue_date, amount: Number(i.total) })),
    6,
  );
  const monthlyProfit = bucketByMonth(
    shipList.map((s) => {
      const p = profitByShipment.get(s.id);
      const amount = p
        ? Number(p.margin)
        : Number(s.customer_rate) - Number(s.carrier_cost);
      return {
        date: s.delivery_date || s.pickup_date || s.created_at,
        amount,
      };
    }),
    6,
  );

  const topCustomers = Object.entries(
    profitList.reduce<Record<string, number>>((acc, p) => {
      acc[p.customer_id] = (acc[p.customer_id] || 0) + Number(p.margin);
      return acc;
    }, {}),
  )
    .map(([id, value]) => ({ name: customerName.get(id) ?? "Customer", value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const leastProfitable = [...profitList]
    .map((p) => ({
      load: p.load_number,
      customer: customerName.get(p.customer_id) ?? "—",
      margin: Number(p.margin),
    }))
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 5);

  const carrierPerf = (carriers ?? []).map((c) => {
    const loads = shipList.filter((s) => s.carrier_id === c.id);
    const done = loads.filter((s) =>
      ["delivered", "completed"].includes(s.status),
    ).length;
    return { name: c.name, rating: c.rating, loads: loads.length, delivered: done };
  });

  // ——— EXECUTIVE ———
  if (profile.role === "manager") {
    const active = shipList.filter((s) =>
      ["scheduled", "assigned", "booked", "picked_up", "in_transit"].includes(s.status),
    ).length;
    const delivered = shipList.filter((s) =>
      ["delivered", "completed"].includes(s.status),
    ).length;

    return (
      <div className="space-y-6">
        <Header
          title="Executive Dashboard"
          subtitle="Company-wide revenue, margin, cash, and approval alerts"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat title="Revenue" value={money(revenue)} />
          <Stat title="Gross profit" value={money(grossProfit)} warn={grossProfit < 0} />
          <Stat title="Profit margin" value={`${marginPct.toFixed(1)}%`} warn={marginPct < 0} />
          <Stat title="Active shipments" value={String(active)} />
          <Stat title="Delivered shipments" value={String(delivered)} />
          <Stat title="Accounts receivable" value={money(ar)} />
          <Stat title="Open invoices" value={String(openInvoices.length)} />
          <Stat title="Pending approvals" value={String((approvals ?? []).length)} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Monthly revenue"><MonthlyBars data={monthlyRev} name="Revenue" /></Panel>
          <Panel title="Monthly profit"><MonthlyBars data={monthlyProfit} name="Profit" /></Panel>
          <Panel title="Top customers"><HorizontalBars data={topCustomers} name="Margin" /></Panel>
          <Panel title="Least profitable shipments">
            <MiniTable
              headers={["Load", "Customer", "Margin"]}
              rows={leastProfitable.map((r) => [r.load, r.customer, money(r.margin)])}
            />
          </Panel>
        </div>
        <Panel title="Carrier performance">
          <MiniTable
            headers={["Carrier", "Rating", "Loads", "Delivered"]}
            rows={carrierPerf.map((c) => [
              c.name,
              String(c.rating ?? "—"),
              String(c.loads),
              String(c.delivered),
            ])}
          />
        </Panel>
        <Panel title="Alerts requiring approval">
          {(approvals ?? []).length === 0 ? (
            <p className="text-sm opacity-70">No pending approvals.</p>
          ) : (
            <ul className="space-y-3">
              {(approvals ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-warning/40 bg-warning/10 p-3">
                  <div>
                    <p className="font-medium capitalize">{a.request_type} · {money(a.amount)}</p>
                    <p className="text-sm opacity-70">{a.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={reviewApproval}>
                      <input type="hidden" name="approval_id" value={a.id} />
                      <input type="hidden" name="decision" value="approved" />
                      <button className="btn btn-success btn-xs">Approve</button>
                    </form>
                    <form action={reviewApproval}>
                      <input type="hidden" name="approval_id" value={a.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <button className="btn btn-error btn-xs">Reject</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    );
  }

  // ——— BROKER OPS ———
  if (profile.role === "broker") {
    const pickupsToday = shipList.filter((s) => s.pickup_date === today).length;
    const deliveriesToday = shipList.filter((s) => s.delivery_date === today || s.promised_delivery_date === today).length;
    const inTransit = shipList.filter((s) => s.status === "in_transit");
    const delayed = shipList.filter(
      (s) =>
        s.promised_delivery_date &&
        s.promised_delivery_date < today &&
        !["delivered", "completed", "cancelled"].includes(s.status),
    );
    const unassigned = shipList.filter((s) => !s.carrier_id && s.status !== "cancelled");
    const availableCarriers = (carriers ?? []).length;

    return (
      <div className="space-y-6">
        <Header
          title="Operations Dashboard"
          subtitle="Today's freight board — pickups, coverage, and delays"
          action={<Link href="/shipments/new" className="btn btn-primary btn-sm">New shipment</Link>}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Stat title="Today's pickups" value={String(pickupsToday)} />
          <Stat title="Today's deliveries" value={String(deliveriesToday)} />
          <Stat title="In transit" value={String(inTransit.length)} />
          <Stat title="Delayed loads" value={String(delayed.length)} warn={delayed.length > 0} />
          <Stat title="Unassigned loads" value={String(unassigned.length)} warn={unassigned.length > 0} />
          <Stat title="Carriers on roster" value={String(availableCarriers)} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Unassigned loads">
            <ShipmentList rows={unassigned} empty="All loads have carriers." />
          </Panel>
          <Panel title="Delayed loads">
            <ShipmentList rows={delayed} empty="No delayed loads." />
          </Panel>
        </div>
        <Panel title="Shipments in transit">
          <ShipmentList rows={inTransit} empty="Nothing in transit." />
        </Panel>
      </div>
    );
  }

  // ——— BILLING ———
  if (profile.role === "billing") {
    const paidToday = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
    for (const inv of openInvoices) {
      const bal = Number(inv.total) - Number(inv.amount_paid);
      const days = Math.floor(
        (Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days <= 0) aging.current += bal;
      else if (days <= 30) aging.d30 += bal;
      else if (days <= 60) aging.d60 += bal;
      else aging.d90 += bal;
    }
    const agingChart = [
      { name: "Current", value: Math.round(aging.current) },
      { name: "1-30", value: Math.round(aging.d30) },
      { name: "31-60", value: Math.round(aging.d60) },
      { name: "60+", value: Math.round(aging.d90) },
    ];

    return (
      <div className="space-y-6">
        <Header
          title="Billing Dashboard"
          subtitle="Invoices, collections, aging, and disputes"
          action={<Link href="/payments" className="btn btn-primary btn-sm">Record payment</Link>}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Stat title="Open invoices" value={String(openInvoices.length)} />
          <Stat title="Past due invoices" value={String(pastDue.length)} warn={pastDue.length > 0} />
          <Stat title="AR balance" value={money(ar)} />
          <Stat title="Payments received today" value={money(paidToday)} />
          <Stat title="Open disputes" value={String((disputes ?? []).length)} />
          <Stat title="60+ day AR" value={money(aging.d90)} warn={aging.d90 > 0} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Invoice aging"><StatusPie data={agingChart} /></Panel>
          <Panel title="Billing disputes">
            {(disputes ?? []).length === 0 ? (
              <p className="text-sm opacity-70">No open disputes.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(disputes ?? []).map((d) => (
                  <li key={d.id} className="rounded-box bg-warning/15 p-3">
                    {d.reason} — {money(d.amount_disputed)}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/disputes" className="btn btn-ghost btn-sm mt-3">View all disputes</Link>
          </Panel>
        </div>
        <Panel title="Past due invoices">
          <MiniTable
            headers={["Invoice", "Customer", "Balance", "Due"]}
            rows={pastDue.slice(0, 8).map((i) => [
              i.invoice_number,
              (i.customers as { name?: string } | null)?.name ?? "—",
              money(Number(i.total) - Number(i.amount_paid)),
              i.due_date,
            ])}
          />
        </Panel>
      </div>
    );
  }

  // ——— SHIPPER ———
  if (profile.role === "customer") {
    const current = shipList.filter(
      (s) => !["completed", "cancelled"].includes(s.status),
    );
    const recentDeliveries = shipList.filter((s) =>
      ["delivered", "completed"].includes(s.status),
    );

    return (
      <div className="space-y-6">
        <Header title="My Dashboard" subtitle="Your freight status, deliveries, and balance" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat title="Current shipments" value={String(current.length)} />
          <Stat title="Recent deliveries" value={String(recentDeliveries.length)} />
          <Stat title="Outstanding balance" value={money(ar)} />
          <Stat title="Recent invoices" value={String(invList.length)} />
        </div>
        <Panel title="Shipment status">
          <ShipmentList rows={current} empty="No active shipments." />
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Recent deliveries">
            <ShipmentList rows={recentDeliveries.slice(0, 5)} empty="No deliveries yet." />
          </Panel>
          <Panel title="Recent invoices">
            <MiniTable
              headers={["Invoice", "Status", "Balance"]}
              rows={invList.slice(0, 5).map((i) => [
                i.invoice_number,
                i.status,
                money(Number(i.total) - Number(i.amount_paid)),
              ])}
            />
          </Panel>
        </div>
      </div>
    );
  }

  // ——— CARRIER ———
  const assigned = shipList.filter((s) =>
    !["cancelled", "completed"].includes(s.status),
  );
  const upcomingPickups = shipList.filter(
    (s) => s.pickup_date && s.pickup_date >= today && ["assigned", "scheduled", "booked"].includes(s.status),
  );
  const dueToday = shipList.filter(
    (s) =>
      (s.promised_delivery_date === today || s.delivery_date === today) &&
      !["completed", "cancelled"].includes(s.status),
  );
  const completed = shipList.filter((s) =>
    ["delivered", "completed"].includes(s.status),
  );

  return (
    <div className="space-y-6">
      <Header title="Assigned Loads" subtitle="Your pickups, deliveries, and completed work" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Assigned loads" value={String(assigned.length)} />
        <Stat title="Upcoming pickups" value={String(upcomingPickups.length)} />
        <Stat title="Deliveries due today" value={String(dueToday.length)} />
        <Stat title="Completed loads" value={String(completed.length)} />
      </div>
      <Panel title="Assigned loads">
        <ShipmentList rows={assigned} empty="No assigned loads." />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Upcoming pickups">
          <ShipmentList rows={upcomingPickups} empty="No upcoming pickups." />
        </Panel>
        <Panel title="POD documents on file">
          <p className="text-sm opacity-70 mb-2">
            {(pods ?? []).length} proof-of-delivery record(s).{" "}
            <Link href="/documents" className="link">Open documents</Link>
          </p>
          <ShipmentList rows={completed.slice(0, 5)} empty="No completed loads yet." />
        </Panel>
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
    <div className="stats bg-base-100 shadow-sm w-full">
      <div className="stat py-3">
        <div className="stat-title text-xs">{title}</div>
        <div className={`stat-value text-2xl ${warn ? "text-error" : "text-primary"}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="card-title text-base">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function MiniTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShipmentList({
  rows,
  empty,
}: {
  rows: {
    id: string;
    load_number: string;
    status: string;
    customers?: unknown;
    carriers?: unknown;
    pickup_location?: string;
    origin_city?: string;
    dest_city?: string;
  }[];
  empty: string;
}) {
  if (!rows.length) return <p className="text-sm opacity-70">{empty}</p>;
  return (
    <ul className="divide-y divide-base-200">
      {rows.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div>
            <Link href={`/shipments/${s.id}`} className="link link-primary font-medium">
              {s.load_number}
            </Link>
            <p className="text-xs opacity-60">
              {(s.customers as { name?: string } | null)?.name ?? "Customer"} ·{" "}
              {(s.carriers as { name?: string } | null)?.name ?? "No carrier"}
            </p>
          </div>
          <span className={`badge ${statusBadge(s.status)}`}>{s.status}</span>
        </li>
      ))}
    </ul>
  );
}
