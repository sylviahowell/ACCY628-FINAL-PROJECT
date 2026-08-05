import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePathAccess } from "@/lib/authz";
import {
  isControlOverrideNote,
  parseControlKindParam,
  type ControlActivityKindFilter,
} from "@/lib/control-activity";
import { sanitizeDemoText } from "@/lib/display-text";
import { resolveSearchParams } from "@/components/FilterBanner";
import { money } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type ActivityKind = "override" | "approval" | "collection";

type ActivityRow = {
  id: string;
  kind: ActivityKind;
  at: string;
  actor: string;
  summary: string;
  href: string | null;
  hrefLabel: string | null;
};

const KIND_TABS: { id: ControlActivityKindFilter; label: string }[] = [
  { id: "override", label: "Overrides" },
  { id: "approval", label: "Approvals" },
  { id: "collection", label: "Collections" },
  { id: "all", label: "All" },
];

function kindBadge(kind: ActivityKind) {
  switch (kind) {
    case "override":
      return "badge-warning";
    case "approval":
      return "badge-info";
    case "collection":
      return "badge-accent";
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
    default:
      return "Activity";
  }
}

/**
 * Manager-only Control activity — override-first audit trail of credit/discount
 * overrides, decided approvals, and collection notes (not routine status history).
 */
export default async function ControlsPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const profile = await requirePathAccess("/controls");
  if (profile.role !== "manager") redirect("/dashboard");

  const params = await resolveSearchParams(searchParams);
  // Bare /controls (left nav) auto-falls back to All when no overrides exist yet.
  const requestedKind = params.kind ? parseControlKindParam(params.kind) : null;

  const supabase = await createClient();

  const [
    { data: statusRows },
    { data: approvals },
    { data: notes },
    { count: pendingApprovalCount },
  ] = await Promise.all([
    supabase
      .from("shipment_status_updates")
      .select("id, shipment_id, from_status, to_status, note, changed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("approval_requests")
      .select(
        "id, request_type, amount, reason, status, entity_type, entity_id, requested_by, reviewed_by, reviewed_at, created_at",
      )
      .in("status", ["approved", "rejected"])
      .order("reviewed_at", { ascending: false })
      .limit(25),
    supabase
      .from("collection_notes")
      .select("id, invoice_id, note, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("approval_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const overrideStatusRows = (statusRows ?? []).filter((r) =>
    isControlOverrideNote(r.note),
  );

  const shipmentIds = [
    ...new Set(overrideStatusRows.map((r) => r.shipment_id).filter(Boolean) as string[]),
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
    ...new Set((notes ?? []).map((n) => n.invoice_id).filter(Boolean) as string[]),
  ];

  const profileIds = [
    ...new Set(
      [
        ...overrideStatusRows.map((r) => r.changed_by),
        ...(approvals ?? []).flatMap((a) => [a.requested_by, a.reviewed_by]),
        ...(notes ?? []).map((n) => n.created_by),
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

  const overrideActivities: ActivityRow[] = overrideStatusRows.slice(0, 30).map((row) => {
    const load = loadById.get(row.shipment_id);
    const note = sanitizeDemoText(row.note);
    return {
      id: `status-${row.id}`,
      kind: "override" as const,
      at: row.created_at,
      actor: row.changed_by ? nameById.get(row.changed_by) ?? "Staff" : "Staff",
      summary: note || "Control override logged",
      href: `/shipments/${row.shipment_id}`,
      hrefLabel: load ?? "Shipment",
    };
  });

  const approvalActivities: ActivityRow[] = (approvals ?? []).map((a) => {
    let shipmentId: string | null = null;
    if (a.entity_type === "shipment") shipmentId = a.entity_id;
    else if (a.entity_type === "shipment_charge") {
      shipmentId = chargeToShipment.get(a.entity_id) ?? null;
    }
    const load = shipmentId ? loadById.get(shipmentId) : null;
    const reviewer = a.reviewed_by ? nameById.get(a.reviewed_by) : null;
    return {
      id: `approval-${a.id}`,
      kind: "approval" as const,
      at: a.reviewed_at ?? a.created_at ?? new Date().toISOString(),
      actor: reviewer ?? "Manager",
      summary: `${a.request_type} ${a.status}${a.amount != null ? ` · ${money(a.amount)}` : ""}${
        a.reason ? ` — ${sanitizeDemoText(a.reason)?.slice(0, 120)}` : ""
      }`,
      href: shipmentId ? `/shipments/${shipmentId}` : "/approvals",
      hrefLabel: load ?? "Approvals",
    };
  });

  const collectionActivities: ActivityRow[] = (notes ?? []).map((n) => {
    const invNum = invById.get(n.invoice_id);
    return {
      id: `note-${n.id}`,
      kind: "collection" as const,
      at: n.created_at,
      actor: n.created_by ? nameById.get(n.created_by) ?? "Staff" : "Staff",
      summary: sanitizeDemoText(n.note) || "Collection note",
      href: invNum ? `/ar?focus=${encodeURIComponent(invNum)}` : "/ar",
      hrefLabel: invNum ?? "AR",
    };
  });

  const byKind: Record<ActivityKind, ActivityRow[]> = {
    override: overrideActivities,
    approval: approvalActivities,
    collection: collectionActivities,
  };

  const fellBackToAll = requestedKind === null && overrideActivities.length === 0;
  const kindFilter: ControlActivityKindFilter =
    requestedKind ?? (fellBackToAll ? "all" : "override");

  const pool =
    kindFilter === "all"
      ? [...overrideActivities, ...approvalActivities, ...collectionActivities]
      : byKind[kindFilter];

  const recent = [...pool]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 50);

  const pendingApprovals = pendingApprovalCount ?? 0;
  const overrideCount = overrideActivities.length;
  const decidedApprovalCount = approvalActivities.length;

  const emptyCopy: Record<ControlActivityKindFilter, string> = {
    override: "No control overrides logged yet (credit, discount, or contract-window).",
    approval: "No decided approvals in the recent window.",
    collection: "No collection notes yet.",
    all: "No control-relevant activity yet.",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold">Control activity</h1>
          <p className="mt-1 text-sm opacity-70">
            Compensating audit trail: logged overrides, decided approvals, and collection notes.
            Routine shipment status lives on each load timeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/settings" className="link link-hover opacity-70">
            Settings policies
          </Link>
          <Link href="/risk" className="link link-hover opacity-70">
            Risk &amp; Credit
          </Link>
          <Link href="/approvals" className="link link-hover opacity-70">
            Approvals inbox
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat py-3">
            <div className="stat-title">Overrides</div>
            <div className="stat-value text-2xl">{overrideCount}</div>
            <div className="stat-desc">In recent control log</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat py-3">
            <div className="stat-title">Decided approvals</div>
            <div className="stat-value text-2xl">{decidedApprovalCount}</div>
            <div className="stat-desc">Approved or rejected</div>
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

      {fellBackToAll ? (
        <p className="rounded-box border border-info/30 bg-info/10 px-4 py-2.5 text-sm">
          No overrides logged yet, so all control activity is shown. Overrides appear here after a
          manager books above a credit limit or approves a broker discount.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Control activity kind">
        {KIND_TABS.map((tab) => {
          const active = kindFilter === tab.id;
          const href = `/controls?kind=${tab.id}`;
          const count =
            tab.id === "all"
              ? overrideCount + decidedApprovalCount + collectionActivities.length
              : tab.id === "override"
                ? overrideCount
                : tab.id === "approval"
                  ? decidedApprovalCount
                  : collectionActivities.length;
          return (
            <Link
              key={tab.id}
              href={href}
              role="tab"
              aria-selected={active}
              className={`btn btn-sm ${active ? "btn-primary" : "btn-ghost"}`}
            >
              {tab.label}
              <span className={`badge badge-xs ${active ? "badge-primary" : ""}`}>{count}</span>
            </Link>
          );
        })}
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-0">
          {recent.length === 0 ? (
            <p className="p-6 text-sm opacity-70">{emptyCopy[kindFilter]}</p>
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
        Pending approvals stay in the Approvals inbox; this page is for review after the fact.
      </p>
    </div>
  );
}
