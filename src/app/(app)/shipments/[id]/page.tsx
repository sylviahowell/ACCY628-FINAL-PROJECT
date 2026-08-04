import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import {
  generateInvoice,
  requestAccessorial,
  updateShipmentStatus,
  uploadPod,
} from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { isStaff, money, statusBadge, type ShipmentStatus } from "@/lib/types";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("shipments")
    .select("*, customers(name), carriers(name), contracts(contract_number, title)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  const { data: profit } = await supabase
    .from("shipment_profitability")
    .select("*")
    .eq("shipment_id", id)
    .maybeSingle();
  const { data: charges } = await supabase
    .from("shipment_charges")
    .select("*")
    .eq("shipment_id", id);
  const { data: pods } = await supabase
    .from("proof_of_delivery")
    .select("*")
    .eq("shipment_id", id);
  const { data: timeline } = await supabase
    .from("shipment_status_updates")
    .select("*")
    .eq("shipment_id", id)
    .order("created_at", { ascending: false });
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("shipment_id", id);

  const margin = Number(profit?.margin ?? 0);
  const canOperate =
    isStaff(profile.role) ||
    (profile.role === "carrier" && profile.carrier_id === s.carrier_id);

  async function setStatus(status: ShipmentStatus, _fd?: FormData) {
    "use server";
    await updateShipmentStatus(id, status);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/shipments" className="link link-hover text-sm">← Shipments</Link>
          <h1 className="text-2xl font-bold">{s.load_number}</h1>
          <p className="text-sm opacity-70">
            {s.pickup_location} → {s.delivery_location}
          </p>
          <span className={`badge mt-2 ${statusBadge(s.status)}`}>{s.status}</span>
        </div>
        {canOperate ? (
          <div className="flex flex-wrap gap-2">
            {s.status === "scheduled" || s.status === "assigned" || s.status === "booked" ? (
              <form action={setStatus.bind(null, "picked_up")}>
                <button className="btn btn-sm">Confirm pickup</button>
              </form>
            ) : null}
            {["picked_up", "assigned", "booked"].includes(s.status) ? (
              <form action={setStatus.bind(null, "in_transit")}>
                <button className="btn btn-sm btn-outline">Mark in transit</button>
              </form>
            ) : null}
            {isStaff(profile.role) && ["delivered", "completed"].includes(s.status) ? (
              <form action={generateInvoice.bind(null, id)}>
                <button className="btn btn-sm btn-primary">Generate invoice</button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {margin < 0 ? (
        <div className="alert alert-warning">
          <span>Warning: this shipment is currently unprofitable ({money(margin)} margin).</span>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="stats bg-base-100 shadow-sm"><div className="stat"><div className="stat-title">Customer rate</div><div className="stat-value text-2xl">{money(s.customer_rate)}</div></div></div>
        <div className="stats bg-base-100 shadow-sm"><div className="stat"><div className="stat-title">Carrier cost</div><div className="stat-value text-2xl">{money(s.carrier_cost)}</div></div></div>
        <div className="stats bg-base-100 shadow-sm"><div className="stat"><div className="stat-title">Profit</div><div className={`stat-value text-2xl ${margin < 0 ? "text-error" : "text-success"}`}>{money(margin)}</div></div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Details</h2>
            <ul className="text-sm space-y-1">
              <li>Customer: {(s.customers as { name?: string } | null)?.name}</li>
              <li>Carrier: {(s.carriers as { name?: string } | null)?.name ?? "Unassigned"}</li>
              <li>Contract: {(s.contracts as { contract_number?: string } | null)?.contract_number ?? "Spot"}</li>
              <li>Freight: {s.freight_type ?? "—"} · Weight {s.weight_lbs ?? "—"} lbs</li>
              <li>Pickup {s.pickup_date ?? "TBD"} · Delivery {s.delivery_date ?? "TBD"}</li>
            </ul>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Proof of delivery</h2>
            {(pods ?? []).length ? (
              <ul className="text-sm space-y-2">
                {(pods ?? []).map((p) => (
                  <li key={p.id} className="rounded-box bg-base-200 p-3">
                    Signed by {p.signed_by ?? "—"} · {new Date(p.delivered_at).toLocaleString()}
                    <div className="opacity-70">{p.notes}</div>
                    {p.file_url ? <a className="link" href={p.file_url}>POD link</a> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm opacity-70">No POD yet.</p>
            )}
            {canOperate ? (
              <form action={uploadPod} className="mt-3 grid gap-2">
                <input type="hidden" name="shipment_id" value={id} />
                <input name="signed_by" placeholder="Receiver name" className="input input-bordered input-sm" />
                <input name="file_url" placeholder="POD file URL (simulated)" className="input input-bordered input-sm" />
                <input name="notes" placeholder="Notes" className="input input-bordered input-sm" />
                <button className="btn btn-success btn-sm">Confirm delivery + upload POD</button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Accessorial charges</h2>
          <ul className="mb-3 space-y-1 text-sm">
            {(charges ?? []).map((c) => (
              <li key={c.id} className="flex justify-between gap-2 border-b border-base-200 py-2">
                <span>{c.description} <span className="badge badge-ghost badge-xs">{c.approval_status}</span></span>
                <span>{money(c.amount)}</span>
              </li>
            ))}
          </ul>
          {canOperate ? (
            <form action={requestAccessorial} className="grid gap-2 md:grid-cols-2">
              <input type="hidden" name="shipment_id" value={id} />
              <input name="description" required placeholder="Charge description" className="input input-bordered input-sm" />
              <input name="amount" type="number" step="0.01" required placeholder="Amount" className="input input-bordered input-sm" />
              <label className="label cursor-pointer justify-start gap-2">
                <input type="checkbox" name="payable_to_carrier" className="checkbox checkbox-sm" />
                <span className="label-text">Payable to carrier</span>
              </label>
              <button className="btn btn-outline btn-sm">Request / add charge</button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Invoices</h2>
            {(invoices ?? []).length === 0 ? (
              <p className="text-sm opacity-70">Not billed yet.</p>
            ) : (
              <ul className="text-sm space-y-2">
                {(invoices ?? []).map((inv) => (
                  <li key={inv.id}>
                    <Link href="/invoices" className="link">{inv.invoice_number}</Link>{" "}
                    <span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span>{" "}
                    {money(inv.amount_paid)} / {money(inv.total)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Status timeline</h2>
            <ul className="timeline timeline-vertical timeline-compact">
              {(timeline ?? []).map((t) => (
                <li key={t.id}>
                  <hr />
                  <div className="timeline-start text-xs opacity-60">
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                  <div className="timeline-middle">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                  </div>
                  <div className="timeline-end timeline-box text-sm">
                    {t.from_status ?? "—"} → {t.to_status}
                    {t.note ? ` · ${t.note}` : ""}
                  </div>
                  <hr />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
