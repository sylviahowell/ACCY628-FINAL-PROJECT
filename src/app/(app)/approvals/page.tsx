import Link from "next/link";
import { requirePathAccess } from "@/lib/authz";
import { ApprovalsTriage, type ApprovalRow } from "@/components/ApprovalsTriage";
import { sanitizeDemoText } from "@/lib/display-text";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";

type EntityContext = {
  shipmentId: string | null;
  loadNumber: string;
  href: string;
  openLabel: string;
};

async function buildEntityContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: { entity_type: string; entity_id: string }[],
): Promise<Map<string, EntityContext>> {
  const map = new Map<string, EntityContext>();

  const chargeIds = [
    ...new Set(rows.filter((a) => a.entity_type === "shipment_charge").map((a) => a.entity_id)),
  ];
  const shipmentIdsDirect = [
    ...new Set(rows.filter((a) => a.entity_type === "shipment").map((a) => a.entity_id)),
  ];
  const coverageIds = [
    ...new Set(rows.filter((a) => a.entity_type === "coverage_request").map((a) => a.entity_id)),
  ];

  const chargeToShipment = new Map<string, string>();
  if (chargeIds.length) {
    const { data: charges } = await supabase
      .from("shipment_charges")
      .select("id, shipment_id")
      .in("id", chargeIds);
    for (const c of charges ?? []) chargeToShipment.set(c.id, c.shipment_id);
  }

  const allShipmentIds = [
    ...new Set([...shipmentIdsDirect, ...chargeToShipment.values()]),
  ];
  const loadByShipment = new Map<string, string>();
  if (allShipmentIds.length) {
    const { data: ships } = await supabase
      .from("shipments")
      .select("id, load_number")
      .in("id", allShipmentIds);
    for (const s of ships ?? []) loadByShipment.set(s.id, s.load_number);
  }

  if (coverageIds.length) {
    const { data: coverage } = await supabase
      .from("coverage_requests")
      .select("id, pickup_location, delivery_location, customers(name)")
      .in("id", coverageIds);
    for (const r of coverage ?? []) {
      const customerName = (r.customers as { name?: string } | null)?.name ?? "Customer";
      map.set(`coverage_request:${r.id}`, {
        shipmentId: null,
        loadNumber: customerName,
        href: `/coverage?focus=${r.id}`,
        openLabel: "Open load request",
      });
    }
  }

  for (const a of rows) {
    if (a.entity_type === "shipment") {
      const loadNumber = loadByShipment.get(a.entity_id);
      if (loadNumber) {
        map.set(`${a.entity_type}:${a.entity_id}`, {
          shipmentId: a.entity_id,
          loadNumber,
          href: `/shipments/${a.entity_id}`,
          openLabel: "Open load",
        });
      }
    } else if (a.entity_type === "shipment_charge") {
      const shipmentId = chargeToShipment.get(a.entity_id);
      if (!shipmentId) continue;
      const loadNumber = loadByShipment.get(shipmentId);
      if (loadNumber) {
        map.set(`${a.entity_type}:${a.entity_id}`, {
          shipmentId,
          loadNumber,
          href: `/shipments/${shipmentId}`,
          openLabel: "Open load",
        });
      }
    }
  }

  return map;
}

function toRow(
  a: {
    id: string;
    request_type: string;
    amount: number;
    reason: string | null;
    created_at: string | null;
    entity_type: string;
    entity_id: string;
  },
  ctx: Map<string, EntityContext>,
): ApprovalRow {
  const related = ctx.get(`${a.entity_type}:${a.entity_id}`);
  return {
    id: a.id,
    request_type: a.request_type,
    amount: a.amount,
    reason: a.reason,
    created_at: a.created_at,
    loadNumber: related?.loadNumber ?? null,
    shipmentHref: related?.href ?? null,
    openLabel: related?.openLabel ?? null,
  };
}

export default async function ApprovalsPage() {
  const profile = await requirePathAccess("/approvals");
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: history } = await supabase
    .from("approval_requests")
    .select("*")
    .neq("status", "pending")
    .order("reviewed_at", { ascending: false })
    .limit(25);

  const allRows = [...(pending ?? []), ...(history ?? [])];
  const ctx = await buildEntityContext(supabase, allRows);
  const pendingRows = (pending ?? []).map((a) => toRow(a, ctx));
  const canDecide = profile.role === "manager";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approval Inbox</h1>
        <p className="text-sm opacity-70">
          Discounts, large accessorials, and credit-hold load overrides wait here until a manager
          decides. Credit-hold items open Load requests so the manager can book with an override.
        </p>
      </div>

      {!canDecide ? (
        <div className="alert">
          <span>
            You can see related items in Warnings. Only managers can approve or reject from this
            inbox.
          </span>
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Pending ({pendingRows.length})</h2>
        <ApprovalsTriage pending={pendingRows} canDecide={canDecide} />
      </div>

      <details className="rounded-box border border-base-300 bg-base-100">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
          Recent decisions ({(history ?? []).length})
        </summary>
        <div className="border-t border-base-300 px-4 py-3">
          {(history ?? []).length === 0 ? (
            <p className="text-sm opacity-70">No prior decisions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Load</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(history ?? []).map((a) => {
                    const related = ctx.get(`${a.entity_type}:${a.entity_id}`);
                    const href = related?.href ?? null;
                    return (
                      <tr key={a.id}>
                        <td className="capitalize">
                          {a.request_type === "credit_hold" || a.request_type === "credit_override"
                            ? "Credit hold"
                            : a.request_type}
                        </td>
                        <td className="text-sm">{related?.loadNumber ?? "—"}</td>
                        <td>{money(a.amount)}</td>
                        <td>
                          <span
                            className={`badge badge-sm ${
                              a.status === "approved" ? "badge-success" : "badge-error"
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="max-w-xs truncate text-sm opacity-70">
                          {sanitizeDemoText(a.reason)}
                        </td>
                        <td>
                          {href ? (
                            <Link href={href} className="link link-primary text-xs">
                              Open
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
