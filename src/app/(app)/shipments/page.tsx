import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { isOperations, money, statusBadge } from "@/lib/types";
import { isInternalStaff } from "@/lib/roles";

export default async function ShipmentsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  let query = supabase
    .from("shipments")
    .select("*, customers(name), carriers(name)")
    .order("created_at", { ascending: false });

  if (profile.role === "customer" && profile.customer_id) {
    query = query.eq("customer_id", profile.customer_id);
  } else if (profile.role === "carrier" && profile.carrier_id) {
    query = query.eq("carrier_id", profile.carrier_id);
  }

  const { data: shipments } = await query;
  const rows = shipments ?? [];

  const shipmentIds = rows.map((s) => s.id);
  const { data: pods } =
    shipmentIds.length > 0
      ? await supabase.from("proof_of_delivery").select("shipment_id").in("shipment_id", shipmentIds)
      : { data: [] as { shipment_id: string }[] };
  const { data: invoices } =
    shipmentIds.length > 0
      ? await supabase
          .from("invoices")
          .select("shipment_id, status")
          .in("shipment_id", shipmentIds)
      : { data: [] as { shipment_id: string | null; status: string }[] };

  const podSet = new Set((pods ?? []).map((p) => p.shipment_id));
  const billedSet = new Set(
    (invoices ?? [])
      .filter((i) => i.status !== "cancelled" && i.shipment_id)
      .map((i) => i.shipment_id as string),
  );

  const title =
    profile.role === "carrier"
      ? "My assignments"
      : profile.role === "customer"
        ? "My shipments"
        : profile.role === "billing"
          ? "Shipments (billing view)"
          : "Shipments";

  const staffRates = isInternalStaff(profile.role);
  const showDocsReady = true;
  const showReadyToBill = isInternalStaff(profile.role);
  const rateHeader =
    profile.role === "customer"
      ? "Your rate"
      : profile.role === "carrier"
        ? "Your pay"
        : "Sell / Buy";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm opacity-70">
            {profile.role === "billing"
              ? "Open a load to check POD status and billing readiness. Create loads from Broker Operations."
              : profile.role === "customer"
                ? "Track your freight from scheduled pickup through delivery."
                : profile.role === "carrier"
                  ? "Loads assigned to you — update status and upload POD from each load."
                  : "Track freight from scheduled pickup through delivery and completion."}
          </p>
        </div>
        {isOperations(profile.role) ? (
          <Link href="/shipments/new" className="btn btn-primary">
            New shipment
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No shipments to show"
          description={
            profile.role === "carrier"
              ? "Nothing is assigned to your carrier yet."
              : profile.role === "customer"
                ? "You do not have any shipments on this account yet."
                : "Create a load from Broker Operations to start the contract-to-cash flow."
          }
          action={
            isOperations(profile.role) ? (
              <Link href="/shipments/new" className="btn btn-primary btn-sm">
                New shipment
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-box bg-base-100 shadow-sm">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Lane</th>
                <th>Parties</th>
                <th>Status</th>
                <th>{rateHeader}</th>
                {showDocsReady ? <th>Docs / Ready</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const hasPod = podSet.has(s.id);
                const delivered = ["delivered", "completed"].includes(s.status);
                const readyToBill =
                  showReadyToBill && delivered && hasPod && !billedSet.has(s.id);
                return (
                  <tr key={s.id} className="hover">
                    <td>
                      <Link href={`/shipments/${s.id}`} className="link link-primary font-medium">
                        {s.load_number}
                      </Link>
                    </td>
                    <td className="text-sm">
                      {s.pickup_location ?? `${s.origin_city}, ${s.origin_state}`}
                      <div className="opacity-60">
                        → {s.delivery_location ?? `${s.dest_city}, ${s.dest_state}`}
                      </div>
                    </td>
                    <td className="text-sm">
                      {(s.customers as { name?: string } | null)?.name ?? "—"}
                      <div className="opacity-60">
                        {(s.carriers as { name?: string } | null)?.name ?? "No carrier"}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(s.status)}`}>{s.status}</span>
                    </td>
                    <td className="text-sm">
                      {staffRates
                        ? `${money(s.customer_rate)} / ${money(s.carrier_cost)}`
                        : profile.role === "customer"
                          ? money(s.customer_rate)
                          : money(s.carrier_cost)}
                    </td>
                    {showDocsReady ? (
                      <td className="text-sm">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`badge badge-sm ${hasPod ? "badge-success" : "badge-ghost"}`}>
                            POD {hasPod ? "yes" : "no"}
                          </span>
                          {readyToBill ? (
                            <span className="badge badge-sm badge-primary">Ready to bill</span>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
