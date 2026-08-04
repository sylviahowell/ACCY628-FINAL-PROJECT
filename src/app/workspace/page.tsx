import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";

export default async function WorkspaceHome() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  if (profile.role === "manager") {
    const { data: profit } = await supabase
      .from("shipment_profitability")
      .select("*")
      .order("load_number");
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, total, amount_paid, due_date")
      .in("status", ["sent", "partial", "disputed"]);
    const { data: late } = await supabase
      .from("shipments")
      .select("id, load_number, promised_delivery_date, status")
      .in("status", ["booked", "in_transit"]);

    const totalMargin = (profit ?? []).reduce(
      (s, p) => s + Number(p.margin),
      0,
    );
    const openAr = (invoices ?? []).reduce(
      (s, i) => s + (Number(i.total) - Number(i.amount_paid)),
      0,
    );

    return (
      <div className="space-y-6">
        <Header
          title="Manager overview"
          subtitle="Brokerage margin, collections risk, and operational exceptions"
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Booked margin (all loads)" value={money(totalMargin)} />
          <Stat label="Open A/R" value={money(openAr)} />
          <Stat
            label="Active loads"
            value={String((late ?? []).length)}
          />
        </div>
        <Panel title="Shipment margin">
          <Table
            headers={["Load", "Status", "Revenue", "Carrier", "Margin"]}
            rows={(profit ?? []).map((p) => [
              p.load_number,
              p.status,
              money(p.customer_rate),
              money(p.carrier_cost),
              money(p.margin),
            ])}
          />
        </Panel>
        <Panel title="Open receivables">
          <Table
            headers={["Invoice", "Status", "Total", "Paid", "Due"]}
            rows={(invoices ?? []).map((i) => [
              i.invoice_number,
              i.status,
              money(i.total),
              money(i.amount_paid),
              i.due_date,
            ])}
          />
        </Panel>
      </div>
    );
  }

  if (profile.role === "broker") {
    const { data: loads } = await supabase
      .from("shipments")
      .select(
        "id, load_number, status, origin_city, origin_state, dest_city, dest_state, customer_rate, carrier_cost, customers(name), carriers(name)",
      )
      .order("created_at", { ascending: false });

    return (
      <div className="space-y-6">
        <Header
          title="Broker load board"
          subtitle="Book, tender, and track fulfillment against contract terms"
          action={{ href: "/workspace/loads/new", label: "New load" }}
        />
        <Panel title="Active and recent loads">
          <ul className="divide-y divide-slate-200">
            {(loads ?? []).map((load) => (
              <li key={load.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    href={`/workspace/loads/${load.id}`}
                    className="font-medium text-[#0f2744] hover:underline"
                  >
                    {load.load_number}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {load.origin_city}, {load.origin_state} → {load.dest_city},{" "}
                    {load.dest_state}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(load.customers as { name?: string } | null)?.name ?? "Customer"}{" "}
                    · {(load.carriers as { name?: string } | null)?.name ?? "Unassigned"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <StatusPill status={load.status} />
                  <p className="mt-1 text-slate-600">
                    Sell {money(load.customer_rate)} / Buy{" "}
                    {money(load.carrier_cost)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    );
  }

  if (profile.role === "billing") {
    const { data: invoices } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, total, amount_paid, due_date, customers(name), shipment_id",
      )
      .order("issue_date", { ascending: false });
    const { data: disputes } = await supabase
      .from("disputes")
      .select("id, reason, amount_disputed, status, invoice_id")
      .eq("status", "open");

    return (
      <div className="space-y-6">
        <Header
          title="Billing desk"
          subtitle="Bill after delivery evidence, collect, and hold disputed amounts"
          action={{ href: "/workspace/billing", label: "Full AR view" }}
        />
        <Panel title="Invoices">
          <Table
            headers={["Invoice", "Customer", "Status", "Balance", "Due"]}
            rows={(invoices ?? []).map((i) => [
              i.invoice_number,
              (i.customers as { name?: string } | null)?.name ?? "—",
              i.status,
              money(Number(i.total) - Number(i.amount_paid)),
              i.due_date,
            ])}
          />
        </Panel>
        <Panel title="Open disputes">
          {(disputes ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No open disputes.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(disputes ?? []).map((d) => (
                <li key={d.id} className="rounded-md bg-amber-50 px-3 py-2">
                  {d.reason} — {money(d.amount_disputed)}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    );
  }

  if (profile.role === "customer") {
    const { data: loads } = await supabase
      .from("shipments")
      .select(
        "id, load_number, status, origin_city, dest_city, promised_delivery_date, customer_rate",
      )
      .order("created_at", { ascending: false });
    const { data: invoices } = await supabase
      .from("invoices")
      .select("invoice_number, status, total, amount_paid, due_date");

    return (
      <div className="space-y-6">
        <Header
          title="Shipper portal"
          subtitle="Your loads, delivery status, and amounts billed"
        />
        <Panel title="My shipments">
          <Table
            headers={["Load", "Lane", "Status", "Promised", "Rate"]}
            rows={(loads ?? []).map((l) => [
              l.load_number,
              `${l.origin_city} → ${l.dest_city}`,
              l.status,
              l.promised_delivery_date ?? "—",
              money(l.customer_rate),
            ])}
          />
        </Panel>
        <Panel title="My invoices">
          <Table
            headers={["Invoice", "Status", "Total", "Paid", "Due"]}
            rows={(invoices ?? []).map((i) => [
              i.invoice_number,
              i.status,
              money(i.total),
              money(i.amount_paid),
              i.due_date,
            ])}
          />
        </Panel>
      </div>
    );
  }

  // carrier
  const { data: loads } = await supabase
    .from("shipments")
    .select(
      "id, load_number, status, origin_city, origin_state, dest_city, dest_state, pickup_date, promised_delivery_date, carrier_cost",
    )
    .order("pickup_date", { ascending: true });

  return (
    <div className="space-y-6">
      <Header
        title="Carrier assignments"
        subtitle="Upcoming loads, contract requirements, and delivery confirmation"
      />
      <Panel title="Assigned loads">
        <ul className="divide-y divide-slate-200">
          {(loads ?? []).map((load) => (
            <li key={load.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <Link
                  href={`/workspace/loads/${load.id}`}
                  className="font-medium text-[#0f2744] hover:underline"
                >
                  {load.load_number}
                </Link>
                <p className="text-sm text-slate-600">
                  {load.origin_city}, {load.origin_state} → {load.dest_city},{" "}
                  {load.dest_state}
                </p>
                <p className="text-xs text-slate-500">
                  Pickup {load.pickup_date ?? "TBD"} · Promised{" "}
                  {load.promised_delivery_date ?? "TBD"}
                </p>
              </div>
              <div className="text-right">
                <StatusPill status={load.status} />
                <p className="mt-1 text-sm text-slate-600">
                  Pay {money(load.carrier_cost)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
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
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f2744]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="rounded-md bg-[#0f2744] px-4 py-2 text-sm font-medium text-white hover:bg-[#16365c]"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#0f2744]">{value}</p>
    </div>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {headers.map((h) => (
              <th key={h} className="px-2 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-2 text-slate-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    booked: "bg-sky-100 text-sky-800",
    in_transit: "bg-indigo-100 text-indigo-800",
    delivered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-rose-100 text-rose-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
}
