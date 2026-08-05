import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePathAccess } from "@/lib/authz";
import { sanitizeDemoText } from "@/lib/display-text";
import { money } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type ActivityKind = "override" | "status" | "approval" | "collection" | "billing";

type ActivityRow = {
  id: string;
  kind: ActivityKind;
  at: string;
  actor: string;
  summary: string;
  href: string | null;
  hrefLabel: string | null;
};

function kindBadge(kind: ActivityKind) {
  switch (kind) {
    case "override":
      return "badge-warning";
    case "approval":
      return "badge-info";
    case "collection":
      return "badge-accent";
    case "billing":
      return "badge-secondary";
    default:
      return "badge-ghost";
  }
}

function kindLabel(kind: ActivityKind) {
  switch (kind) {
    case "override":
      return "Override";
    case "approval":
      return "Approval";
    case "collection":
      return "Collection";
    case "billing":
      return "Billing";
    default:
      return "Status";
  }
}

function isOverrideNote(note: string | null | undefined) {
  if (!note) return false;
  const n = note.toLowerCase();
  return n.includes("override") || n.includes("credit override") || n.includes("discount");
}

/**
 * Manager-only Control activity — recent status overrides, approval decisions,
 * and collection notes with links into shipments / invoices / approvals.
 */
export default async function ControlsPage() {
  const profile = await requirePathAccess("/controls");
  if (profile.role !== "manager") redirect("/dashboard");

  const supabase = await createClient();

  const [
    { data: statusRows },
    { data: approvals },
    { data: notes },
    { data: billingEvents },
  ] = await Promise.all([
    supabase
      .from("shipment_status_updates")
      .select("id, shipment_id, from_status, to_status, note, changed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("approval_requests")
      .select(
        "id, request_type, amount, reason, status, entity_type, entity_id, requested_by, reviewed_by, reviewed_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("collection_notes")
      .select("id, invoice_id, note, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("status_events")
      .select("id, entity_type, entity_id, from_status, to_status, note, changed_by, created_at")
      .in("entity_type", ["invoice", "payment", "dispute"])
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const shipmentIds = [
    ...new Set((statusRows ?? []).map((r) => r.shipment_id).filter(Boolean) as string[]),
  ];

  const chargeIds = [
    ...new Set(
      (approvals ?? [])
        .filter((a) => a.entity_type === "shipment_charge")
        .map((a) => a.entity_id),
    ),
  ];
  const approvalShipmentIdsDirect = [
    ...new Set(
      (approvals ?? []).filter((a) => a.entity_type === "shipment").map((a) => a.entity_id),
    ),
  ];

  const chargeToShipment = new Map<string, string>();
  if (chargeIds.length) {
    const { data: charges } = await supabase
      .from("shipment_charges")
      .select("id, shipment_id")
      .in("id", chargeIds);
    for (const c of charges ?? []) chargeToShipment.set(c.id, c.shipment_id);
  }

  const allShipIds = [
    ...new Set([
      ...shipmentIds,
      ...approvalShipmentIdsDirect,
      ...chargeToShipment.values(),
    ]),
  ];

  const invoiceIds = [
    ...new Set([
      ...((notes ?? []).map((n) => n.invoice_id).filter(Boolean) as string[]),
      ...(billingEvents ?? [])
        .filter((e) => e.entity_type === "invoice")
        .map((e) => e.entity_id),
    ]),
  ];

  const profileIds = [
    ...new Set(
      [
        ...(statusRows ?? []).map((r) => r.changed_by),
        ...(approvals ?? []).flatMap((a) => [a.requested_by, a.reviewed_by]),
        ...(notes ?? []).map((n) => n.created_by),
        ...(billingEvents ?? []).map((e) => e.changed_by),
      ].filter(Boolean) as string[],
    ),
  ];

  const [{ data: ships }, { data: invoices }, { data: people }] = await Promise.all([
    allShipIds.length
      ? supabase.from("shipments").select("id, load_number").in("id", allShipIds)
      : Promise.resolve({ data: [] as { id: string; load_number: string }[] }),
    invoiceIds.length
      ? supabase.from("invoices").select("id, invoice_number").in("id", invoiceIds)
      : Promise.resolve({ data: [] as { id: string; invoice_number: string }[] }),
    profileIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const loadById = new Map((ships ?? []).map((s) => [s.id, s.load_number]));
  const invById = new Map((invoices ?? []).map((i) => [i.id, i.invoice_number]));
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const activities: ActivityRow[] = [];

  for (const row of statusRows ?? []) {
    const load = loadById.get(row.shipment_id);
    const note = sanitizeDemoText(row.note);
    const override = isOverrideNote(row.note);
    activities.push({
      id: `status-${row.id}`,
      kind: override ? "override" : "status",
      at: row.created_at,
      actor: row.changed_by ? nameById.get(row.changed_by) ?? "Staff" : "Staff",
      summary: override
        ? note || "Control override logged"
        : `${row.from_status ?? "—"} → ${row.to_status}${note ? ` · ${note}` : ""}`,
      href: `/shipments/${row.shipment_id}`,
      hrefLabel: load ?? "Shipment",
    });
  }

  for (const a of approvals ?? []) {
    let shipmentId: string | null = null;
    if (a.entity_type === "shipment") shipmentId = a.entity_id;
    else if (a.entity_type === "shipment_charge") {
      shipmentId = chargeToShipment.get(a.entity_id) ?? null;
    }
    const load = shipmentId ? loadById.get(shipmentId) : null;
    const reviewer = a.reviewed_by ? nameById.get(a.reviewed_by) : null;
    const requester = a.requested_by ? nameById.get(a.requested_by) : "Staff";
    const decided = a.status !== "pending";
    activities.push({
      id: `approval-${a.id}`,
      kind: "approval",
      at: a.reviewed_at ?? a.created_at ?? new Date().toISOString(),
      actor: decided ? reviewer ?? "Manager" : requester ?? "Staff",
      summary: decided
        ? `${a.request_type} ${a.status}${a.amount != null ? ` · ${money(a.amount)}` : ""}${
            a.reason ? ` — ${sanitizeDemoText(a.reason)?.slice(0, 120)}` : ""
          }`
        : `Pending ${a.request_type}${a.amount != null ? ` · ${money(a.amount)}` : ""}`,
      href: decided ? (shipmentId ? `/shipments/${shipmentId}` : "/approvals") : "/approvals",
      hrefLabel: load ?? (decided ? "Approvals" : "Open Approvals"),
    });
  }

  for (const n of notes ?? []) {
    const invNum = invById.get(n.invoice_id);
    activities.push({
      id: `note-${n.id}`,
      kind: "collection",
      at: n.created_at,
      actor: n.created_by ? nameById.get(n.created_by) ?? "Staff" : "Staff",
      summary: sanitizeDemoText(n.note) || "Collection note",
      href: "/ar",
      hrefLabel: invNum ?? "AR",
    });
  }

  for (const e of billingEvents ?? []) {
    const invNum = e.entity_type === "invoice" ? invById.get(e.entity_id) : null;
    const note = sanitizeDemoText(e.note);
    const transition =
      e.from_status && e.to_status
        ? `${e.from_status} → ${e.to_status}`
        : e.to_status;
    activities.push({
      id: `billing-${e.id}`,
      kind: "billing",
      at: e.created_at,
      actor: e.changed_by ? nameById.get(e.changed_by) ?? "Staff" : "Staff",
      summary: `${e.entity_type}: ${transition}${note ? ` · ${note}` : ""}`,
      href:
        e.entity_type === "invoice"
          ? "/invoices"
          : e.entity_type === "payment"
            ? "/payments"
            : "/disputes",
      hrefLabel:
        invNum ??
        (e.entity_type === "payment"
          ? "Payments"
          : e.entity_type === "dispute"
            ? "Disputes"
            : "Invoices"),
    });
  }

  activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const recent = activities.slice(0, 60);
  const overrideCount = recent.filter((a) => a.kind === "override").length;
  const billingCount = recent.filter((a) => a.kind === "billing").length;
  const pendingApprovals = (approvals ?? []).filter((a) => a.status === "pending").length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Control activity</h1>
        <p className="mt-1 text-sm opacity-70">
          Recent status events, approval decisions, credit overrides, collection notes, and billing
          audit events (invoice status, payments, disputes). Compensating visibility when managers
          also perform ops and billing.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat py-3">
            <div className="stat-title">Entries shown</div>
            <div className="stat-value text-2xl">{recent.length}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat py-3">
            <div className="stat-title">Overrides in view</div>
            <div className="stat-value text-2xl">{overrideCount}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat py-3">
            <div className="stat-title">Billing events</div>
            <div className="stat-value text-2xl">{billingCount}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat py-3">
            <div className="stat-title">Pending approvals</div>
            <div className="stat-value text-2xl">{pendingApprovals}</div>
            <div className="stat-actions">
              <Link href="/approvals" className="btn btn-ghost btn-xs">
                Open inbox
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-0">
          {recent.length === 0 ? (
            <p className="p-6 text-sm opacity-70">No control activity logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Who</th>
                    <th>What</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap text-xs opacity-70">
                        {new Date(row.at).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge badge-sm ${kindBadge(row.kind)}`}>
                          {kindLabel(row.kind)}
                        </span>
                      </td>
                      <td className="text-sm font-medium">{row.actor}</td>
                      <td className="max-w-md text-sm">{row.summary}</td>
                      <td>
                        {row.href ? (
                          <Link href={row.href} className="link link-hover text-sm">
                            {row.hrefLabel}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs opacity-60">
        Policies that produce these events are listed under Settings → System control policies.
        See also Risk & Credit and Approvals for live monitoring queues.
      </p>
    </div>
  );
}
