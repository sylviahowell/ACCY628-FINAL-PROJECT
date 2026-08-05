import Link from "next/link";
import { requirePathAccess } from "@/lib/authz";
import { reviewApproval } from "@/lib/actions/freight";
import { sanitizeDemoText } from "@/lib/display-text";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";

function relatedHref(
  entityType: string,
  entityId: string,
  chargeShipmentIds: Map<string, string>,
): string | null {
  if (entityType === "shipment") return `/shipments/${entityId}`;
  if (entityType === "shipment_charge") {
    const shipmentId = chargeShipmentIds.get(entityId);
    return shipmentId ? `/shipments/${shipmentId}` : null;
  }
  return null;
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

  const chargeIds = [
    ...new Set(
      [...(pending ?? []), ...(history ?? [])]
        .filter((a) => a.entity_type === "shipment_charge")
        .map((a) => a.entity_id as string),
    ),
  ];

  const chargeShipmentIds = new Map<string, string>();
  if (chargeIds.length) {
    const { data: charges } = await supabase
      .from("shipment_charges")
      .select("id, shipment_id")
      .in("id", chargeIds);
    for (const c of charges ?? []) {
      chargeShipmentIds.set(c.id, c.shipment_id);
    }
  }

  const canDecide = profile.role === "manager";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approval Inbox</h1>
        <p className="text-sm opacity-70">
          Discounts and large accessorials wait here until a manager decides. Rejections require a
          short comment (saved on the request reason).
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

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Pending ({(pending ?? []).length})</h2>
          {(pending ?? []).length === 0 ? (
            <p className="text-sm opacity-70">Nothing waiting for review.</p>
          ) : (
            <ul className="space-y-4">
              {(pending ?? []).map((a) => {
                const href = relatedHref(a.entity_type, a.entity_id, chargeShipmentIds);
                return (
                  <li key={a.id} className="rounded-box border border-base-300 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium capitalize">
                          {a.request_type} · {money(a.amount)}
                        </p>
                        <p className="text-sm opacity-70">{sanitizeDemoText(a.reason)}</p>
                        <p className="mt-1 text-xs opacity-50">
                          {a.entity_type} · requested{" "}
                          {a.created_at ? new Date(a.created_at).toLocaleString() : "—"}
                        </p>
                      </div>
                      {href ? (
                        <Link href={href} className="btn btn-ghost btn-xs">
                          Related record
                        </Link>
                      ) : null}
                    </div>
                    {canDecide ? (
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <form action={reviewApproval}>
                          <input type="hidden" name="approval_id" value={a.id} />
                          <input type="hidden" name="decision" value="approved" />
                          <button className="btn btn-success btn-sm">Approve</button>
                        </form>
                        <form action={reviewApproval} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="approval_id" value={a.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <label className="form-control">
                            <span className="label-text text-xs">Reject comment (required)</span>
                            <input
                              name="comment"
                              required
                              minLength={3}
                              placeholder="Why rejected?"
                              className="input input-bordered input-sm w-64"
                            />
                          </label>
                          <button className="btn btn-error btn-sm">Reject</button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Recent decisions</h2>
          {(history ?? []).length === 0 ? (
            <p className="text-sm opacity-70">No prior decisions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(history ?? []).map((a) => {
                    const href = relatedHref(a.entity_type, a.entity_id, chargeShipmentIds);
                    return (
                      <tr key={a.id}>
                        <td className="capitalize">{a.request_type}</td>
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
                        <td className="max-w-xs truncate text-sm opacity-70">{sanitizeDemoText(a.reason)}</td>
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
      </div>
    </div>
  );
}
