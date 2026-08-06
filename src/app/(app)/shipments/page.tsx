import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/EmptyState";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
import { FocusScroll } from "@/components/FocusScroll";
import { ShipmentsTriage, type ShipmentListRow } from "@/components/ShipmentsTriage";
import { requirePathAccess } from "@/lib/authz";
import { filterShipments, shipmentFilterLabel } from "@/lib/list-filters";
import { isActiveFinalInvoice } from "@/lib/invoice-helpers";
import { createClient } from "@/lib/supabase/server";
import { isOperations, money } from "@/lib/types";
import { isInternalStaff } from "@/lib/roles";

/** Map manager-nav `?status=` shortcuts onto the shared `?filter=` vocabulary. */
function resolveShipmentFilter(params: Record<string, string | undefined>) {
  if (params.filter) return params.filter;
  if (params.category === "upcoming") return "pickup-upcoming";
  if (params.status === "delayed") return "delayed";
  if (params.status === "unassigned") return "unassigned";
  if (params.status === "ready") return "ready-to-bill";
  if (params.status === "needs_pod" || params.status === "needs-pod") return "needs-pod";
  return undefined;
}

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const profile = await requirePathAccess("/shipments");

  const params = await resolveSearchParams(searchParams);
  const filter = resolveShipmentFilter(params);
  const filterLabel = shipmentFilterLabel(filter);
  const today = new Date().toISOString().slice(0, 10);

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
  const allRowsRaw = shipments ?? [];
  // Offered loads wait in Load offers until the carrier accepts.
  const allRows =
    profile.role === "carrier"
      ? allRowsRaw.filter((s) => s.status !== "offered")
      : allRowsRaw;

  const shipmentIds = allRows.map((s) => s.id);
  const { data: pods } =
    shipmentIds.length > 0
      ? await supabase.from("proof_of_delivery").select("shipment_id").in("shipment_id", shipmentIds)
      : { data: [] as { shipment_id: string }[] };
  const { data: invoices } =
    shipmentIds.length > 0
      ? await supabase
          .from("invoices")
          .select("shipment_id, status, invoice_number")
          .in("shipment_id", shipmentIds)
      : { data: [] as { shipment_id: string | null; status: string; invoice_number: string }[] };

  const podSet = new Set((pods ?? []).map((p) => p.shipment_id));
  const billedSet = new Set(
    (invoices ?? [])
      .filter((i) => isActiveFinalInvoice(i) && i.shipment_id)
      .map((i) => i.shipment_id as string),
  );

  const rows = filterShipments(allRows, filter, { today, podSet, billedSet });

  const title =
    profile.role === "carrier"
      ? "My Deliveries"
      : profile.role === "customer"
        ? "My shipments"
        : profile.role === "billing"
          ? "Shipments (billing view)"
          : "Shipments";

  const staffRates = isInternalStaff(profile.role);
  const showDocsReady = true;
  const showReadyToBill = profile.role === "manager" || profile.role === "billing";
  const triageMode = profile.role === "broker" ? "ops" : "finance";
  const rateHeader =
    profile.role === "customer"
      ? "Your rate"
      : profile.role === "carrier"
        ? "Your pay"
        : "Sell / Buy";

  const listRows: ShipmentListRow[] = rows.map((s) => {
    const hasPod = podSet.has(s.id);
    const delivered = ["delivered", "completed"].includes(s.status);
    const closed = ["delivered", "completed", "cancelled"].includes(s.status);
    const readyToBill = showReadyToBill && delivered && hasPod && !billedSet.has(s.id);
    const needsPod = delivered && !hasPod;
    const isDelayed = Boolean(
      s.promised_delivery_date && s.promised_delivery_date < today && !closed,
    );
    const needsCoverage = !s.carrier_id && !closed;
    const rateDisplay = staffRates
      ? `${money(s.customer_rate)} / ${money(s.carrier_cost)}`
      : profile.role === "customer"
        ? money(s.customer_rate)
        : money(s.carrier_cost);

    return {
      id: s.id,
      loadNumber: s.load_number,
      laneFrom: s.pickup_location ?? `${s.origin_city}, ${s.origin_state}`,
      laneTo: s.delivery_location ?? `${s.dest_city}, ${s.dest_state}`,
      customerName: (s.customers as { name?: string } | null)?.name ?? "—",
      carrierName: (s.carriers as { name?: string } | null)?.name ?? "No carrier",
      status: s.status,
      rateDisplay,
      hasPod,
      readyToBill,
      needsPod,
      isDelayed,
      needsCoverage,
    };
  });

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm opacity-70">
            {profile.role === "billing"
              ? "Open a load to check POD status and billing readiness. Create loads from Broker Operations."
              : profile.role === "customer"
                ? "Track your freight from scheduled pickup through delivery."
                : profile.role === "carrier"
                  ? "Accepted loads only — confirm pickup, update status, and upload POD. New tenders appear under Load offers first."
                  : "Track freight from scheduled pickup through delivery and completion. Use filters to triage exceptions."}
          </p>
        </div>
        {profile.role === "carrier" ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/shipments?filter=pickup-upcoming"
                className={`btn btn-sm ${filter === "pickup-upcoming" ? "btn-primary" : "btn-outline"}`}
              >
                Upcoming pickups
              </Link>
              <Link
                href="/shipments?filter=delivery-due-today"
                className={`btn btn-sm ${filter === "delivery-due-today" ? "btn-primary" : "btn-outline"}`}
              >
                Due today
              </Link>
              <Link
                href="/shipments"
                className={`btn btn-sm ${!filter ? "btn-primary" : "btn-outline"}`}
              >
                All deliveries
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/documents?filter=missing-pod"
                className="btn btn-primary btn-sm"
              >
                Upload POD
              </Link>
              <Link href="/offers" className="btn btn-ghost btn-sm">
                Load offers
              </Link>
            </div>
          </div>
        ) : isOperations(profile.role) ? (
          <Link href="/shipments/new" className="btn btn-primary">
            New shipment
          </Link>
        ) : null}
      </div>

      {filterLabel ? <FilterBanner label={filterLabel} clearHref="/shipments" /> : null}

      {listRows.length === 0 ? (
        <EmptyState
          title={filterLabel ? "No matching shipments" : "No shipments to show"}
          description={
            filterLabel
              ? "Nothing matches this filter right now."
              : profile.role === "carrier"
                ? "No accepted deliveries yet. Check Load offers for pending tenders."
                : profile.role === "customer"
                  ? "You do not have any shipments on this account yet."
                  : "Create a load from Broker Operations to start the contract-to-cash flow."
          }
          action={
            filterLabel ? (
              <Link href="/shipments" className="btn btn-outline btn-sm">
                Show all shipments
              </Link>
            ) : profile.role === "carrier" ? (
              <Link href="/offers" className="btn btn-primary btn-sm">
                Open Load offers
              </Link>
            ) : isOperations(profile.role) ? (
              <Link href="/shipments/new" className="btn btn-primary btn-sm">
                New shipment
              </Link>
            ) : null
          }
        />
      ) : (
        <ShipmentsTriage
          rows={listRows}
          rateHeader={rateHeader}
          showDocsReady={showDocsReady}
          triageMode={triageMode}
        />
      )}
    </div>
  );
}
