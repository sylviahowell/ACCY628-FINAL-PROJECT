import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import {
  addAccessorial,
  confirmDelivery,
  generateInvoice,
  markInTransit,
} from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";

export default async function LoadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: load } = await supabase
    .from("shipments")
    .select(
      "*, customers(name), carriers(name), contracts(contract_number, title, billing_terms)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!load) notFound();

  const { data: charges } = await supabase
    .from("shipment_charges")
    .select("*")
    .eq("shipment_id", id);

  const { data: profit } = await supabase
    .from("shipment_profitability")
    .select("*")
    .eq("shipment_id", id)
    .maybeSingle();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total, amount_paid")
    .eq("shipment_id", id);

  const { data: events } = await supabase
    .from("status_events")
    .select("*")
    .eq("entity_id", id)
    .order("created_at", { ascending: false });

  const canMove =
    ["manager", "broker", "carrier"].includes(profile.role) &&
    ["booked", "in_transit"].includes(load.status);
  const canInvoice =
    ["manager", "broker", "billing"].includes(profile.role) &&
    load.status === "delivered";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/workspace/loads" className="text-sm text-sky-800 hover:underline">
            ← Loads
          </Link>
          <h2 className="mt-2 text-2xl font-semibold text-[#0f2744]">
            {load.load_number}
          </h2>
          <p className="text-sm text-slate-600">
            {load.origin_city}, {load.origin_state} → {load.dest_city},{" "}
            {load.dest_state}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            Status: {load.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMove && load.status === "booked" ? (
            <form action={markInTransit.bind(null, id)}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                Mark in transit
              </button>
            </form>
          ) : null}
          {canMove && load.status !== "delivered" ? (
            <form action={confirmDelivery.bind(null, id)}>
              <button
                type="submit"
                className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white"
              >
                Confirm delivery (POD)
              </button>
            </form>
          ) : null}
          {canInvoice ? (
            <form action={generateInvoice.bind(null, id)}>
              <button
                type="submit"
                className="rounded-md bg-[#0f2744] px-3 py-2 text-sm font-medium text-white"
              >
                Generate invoice
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Customer (sell)"
          value={money(load.customer_rate)}
          note={(load.customers as { name?: string } | null)?.name}
        />
        <Card
          title="Carrier (buy)"
          value={money(load.carrier_cost)}
          note={(load.carriers as { name?: string } | null)?.name ?? "Unassigned"}
        />
        <Card
          title="Brokerage margin"
          value={money(profit?.margin)}
          note="Revenue + billable accessorials − carrier − payable accessorials"
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Contract terms
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          {(load.contracts as { contract_number?: string; title?: string; billing_terms?: string } | null)
            ?.contract_number ?? "Spot / no master contract"}
          {(load.contracts as { title?: string } | null)?.title
            ? ` — ${(load.contracts as { title?: string }).title}`
            : ""}
        </p>
        <p className="text-xs text-slate-500">
          Billing:{" "}
          {(load.contracts as { billing_terms?: string } | null)?.billing_terms ??
            "Per load"}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Accounting note: customer revenue is treated as earned when delivery is
          confirmed (POD). Invoices created before delivery are blocked.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Charges & accessorials
        </h3>
        <ul className="mb-4 space-y-2 text-sm">
          {(charges ?? []).map((c) => (
            <li key={c.id} className="flex justify-between gap-3 border-b border-slate-100 py-2">
              <span>
                {c.description}{" "}
                <span className="text-xs text-slate-500">({c.charge_type})</span>
              </span>
              <span>{money(c.amount)}</span>
            </li>
          ))}
          {(charges ?? []).length === 0 ? (
            <li className="text-slate-500">No accessorials yet.</li>
          ) : null}
        </ul>
        {["manager", "broker", "billing", "carrier"].includes(profile.role) ? (
          <form action={addAccessorial} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="shipment_id" value={id} />
            <input
              name="description"
              required
              placeholder="Description"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="amount"
              type="number"
              step="0.01"
              required
              placeholder="Amount"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input name="billable_to_customer" type="checkbox" defaultChecked />
              Billable to customer
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="payable_to_carrier" type="checkbox" />
              Payable to carrier
            </label>
            <button
              type="submit"
              className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm sm:col-span-2"
            >
              Add accessorial
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Invoices for this load
        </h3>
        {(invoices ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Not billed yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(invoices ?? []).map((inv) => (
              <li key={inv.id} className="flex justify-between">
                <Link href="/workspace/billing" className="hover:underline">
                  {inv.invoice_number} ({inv.status})
                </Link>
                <span>
                  {money(inv.amount_paid)} / {money(inv.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Audit trail
        </h3>
        <ul className="space-y-2 text-sm text-slate-700">
          {(events ?? []).map((e) => (
            <li key={e.id}>
              <span className="font-medium">
                {e.from_status ?? "—"} → {e.to_status}
              </span>
              {e.note ? ` — ${e.note}` : ""}
              <span className="block text-xs text-slate-450 text-slate-500">
                {new Date(e.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note?: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#0f2744]">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}
